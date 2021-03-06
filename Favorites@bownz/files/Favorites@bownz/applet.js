const Applet = imports.ui.applet;
const Mainloop = imports.mainloop;
const GMenu = imports.gi.GMenu;
const Lang = imports.lang;
const Cinnamon = imports.gi.Cinnamon;
const St = imports.gi.St;
const Clutter = imports.gi.Clutter;
const Main = imports.ui.main;
const PopupMenu = imports.ui.popupMenu;
const AppFavorites = imports.ui.appFavorites;
const Gtk = imports.gi.Gtk;
const Gio = imports.gi.Gio;
const Signals = imports.signals;
const GnomeSession = imports.misc.gnomeSession;
const ScreenSaver = imports.misc.screenSaver;
const FileUtils = imports.misc.fileUtils;
const Util = imports.misc.util;
const Tweener = imports.ui.tweener;
const DND = imports.ui.dnd;
const Meta = imports.gi.Meta;
const GLib = imports.gi.GLib;


const AppletMeta = imports.ui.appletManager.applets["Favorites@bownz"];
const AppletDir = imports.ui.appletManager.appletMeta["Favorites@bownz"].path;

const DEFAULT_CONFIG = {
    "SHOW_BOOKMARKS": true, 
    "COLLAPSE_BOOKMARKS": false, 
    "SHOW_DEVICES": true, 
    "COLLAPSE_DEVICES": true, 
    "ICON_SIZE": 22
};

const CONFIG_FILE    = 'applets/Favorites@bownz/config.json';

let configFile = GLib.build_filenamev([global.userdatadir, CONFIG_FILE]);
let config = JSON.parse(Cinnamon.get_file_contents_utf8_sync(configFile)); 

const Choose_The_Icon_Size = config.ICON_SIZE;             //<----------Icon Size for favorites, choose any number.
const Labels_true = config.SHOW_BOOKMARKS;                    /*<----------"true": Has Labels for favorites
							  "false": Has no Labels for favorites   */
const BOXFRAME = config.COLLAPSE_DEVICES;			     /*<----------"true": Has the frame around the whole menu, like the frame around the left column in the Cinnamon menu
					                  "false": All just the normal, default menu. no frame.      */ 
const Icons_true = config.COLLAPSE_BOOKMARKS;                     /*<----------"true": Shows Icons for favorites"
							  "false": Doesn't show an Icon for any favorites.           */
const Tooltips = config.SHOW_DEVICES;                       /*<----------"true": Shows tooltips (If no label, tooltip displays the app title, If there is a label, 
								   It displays the description)
							  "false": Doesn't show tooltips for the apps.               */
let appsys = Cinnamon.AppSystem.get_default();

function MyContextMenuItem()
{
	this._init.apply(this, arguments);
}

MyContextMenuItem.prototype =
{
		__proto__: PopupMenu.PopupBaseMenuItem.prototype,
		_init: function(icon, text, loc, params)
		{
			PopupMenu.PopupBaseMenuItem.prototype._init.call(this, params);
			this.icon = icon;

			
                        this.labeltext = text;
			this.label = new St.Label({ text: text });
			this.addActor(this.icon);
			this.addActor(this.label);
		},

                _onButtonReleaseEvent: function (actor, event)
                {
                        if ( Cinnamon.get_event_state(event) & Clutter.ModifierType.BUTTON1_MASK ) {
                            this.activate(event);
                        } else if (Cinnamon.get_event_state(event) & Clutter.ModifierType.BUTTON3_MASK) {
                            if (this.loc) {
                                if (this.loc == "special:home") {
                                    this.loc = Gio.file_new_for_path(GLib.get_home_dir()).get_uri().replace('file://','');
                                } else if (this.loc == "special:desktop") {
                                    this.loc = Gio.file_new_for_path(GLib.get_user_special_dir(GLib.UserDirectory.DIRECTORY_DESKTOP)).get_uri().replace('file://','');
                                } else if (this.loc == "root") {
                                    this.loc = "/";
                                } else if (this.loc == "special:connect") {
                                    return true;
                                }
                                Main.Util.spawnCommandLine("gnome-terminal --working-directory="+this.loc);
                            }
                        }
                        return true;
                }
};

//genericApplicationButton
function GenericApplicationButton(appsMenuButton, app) {
    this._init(appsMenuButton, app);
}

GenericApplicationButton.prototype = {
    __proto__: PopupMenu.PopupSubMenuMenuItem.prototype,
    
    _init: function(appsMenuButton, app, withMenu) {
        this.app = app;
        this.appsMenuButton = appsMenuButton;
        PopupMenu.PopupBaseMenuItem.prototype._init.call(this, {hover: false});
	
        
        this.withMenu = withMenu;
        
        if (this.withMenu){
            this.menu = new PopupMenu.PopupSubMenu(this.actor);
            this.menu.connect('open-state-changed', Lang.bind(this, this._subMenuOpenStateChanged));
        }
    },
    
    _onButtonReleaseEvent: function (actor, event) {
        if (event.get_button()==1){
            this.activate(event);
        }
        if (event.get_button()==3){
            this.appsMenuButton.closeApplicationsContextMenus(this.app, true);
            this.toggleMenu();
        }
        return true;
    },
    
    activate: function(event) {
        this.app.open_new_window(-1);
        this.appsMenuButton.menu.close();
    },
    
    closeMenu: function() {
        if (this.withMenu) this.menu.close();
    },
    
    toggleMenu: function() {
        if (!this.withMenu) return;
        
        if (!this.menu.isOpen){
            let children = this.menu.box.get_children();
            for (var i in children){
                children[i].destroy();
            }
            let menuItem;
            menuItem = new ApplicationContextMenuItem(this, _("Add to panel"), "add_to_panel");
            this.menu.addMenuItem(menuItem);
            if (USER_DESKTOP_PATH){
                menuItem = new ApplicationContextMenuItem(this, _("Add to desktop"), "add_to_desktop");
                this.menu.addMenuItem(menuItem);
            }
            if (AppFavorites.getAppFavorites().isFavorite(this.app.get_id())){
                menuItem = new ApplicationContextMenuItem(this, _("Remove from favorites"), "remove_from_favorites");
                this.menu.addMenuItem(menuItem);
            }else{
                menuItem = new ApplicationContextMenuItem(this, _("Add to favorites"), "add_to_favorites");
                this.menu.addMenuItem(menuItem);
            }
        }
        this.menu.toggle();
    },
    
    _subMenuOpenStateChanged: function() {
        if (this.menu.isOpen) this.appsMenuButton._scrollToButton(this.menu);
    }
}




function FavoritesButton(appsMenuButton, app, nbFavorites) {
    this._init(appsMenuButton, app, nbFavorites);
}

FavoritesButton.prototype = {
    __proto__: GenericApplicationButton.prototype,
    
    _init: function(appsMenuButton, app, nbFavorites) {
        GenericApplicationButton.prototype._init.call(this, appsMenuButton, app);       
	 
        let monitorHeight = Main.layoutManager.primaryMonitor.height;
        let real_size = (0.7*monitorHeight) / nbFavorites;
        let icon_size = 0.6*real_size;
        if (icon_size>Choose_The_Icon_Size) icon_size = Choose_The_Icon_Size;
        this.actor.add_style_class_name('menu-favorites-button');
if (BOXFRAME){	
	this.actor.add_style_class_name('menu-favorites-box');}

if (Labels_true) {
this.boxwithtt = new St.BoxLayout({ tooltip_text: _(this.app.get_description()) });
}else{
this.boxwithtt = new St.BoxLayout({ tooltip_text: _(this.app.get_name()) });  
}

this.box = new St.BoxLayout(); 

if (Icons_true) {
        this.box.add(app.create_icon_texture(icon_size)); 
	this.boxwithtt.add(app.create_icon_texture(icon_size)); 
};

if (Labels_true) {
	this.label = new St.Label({ text: " " + this.app.get_name(), style_class: 'menu-application-button-label'});
	this.box.add(this.label); 
	this.label = new St.Label({ text: " " + this.app.get_name(), style_class: 'menu-application-button-label'});
	this.boxwithtt.add(this.label); 
};
if (Tooltips){
this.addActor(this.boxwithtt);
}else{
this.addActor(this.box);
}    
    
        this._draggable = DND.makeDraggable(this.actor);     
        this.isDraggableApp = true;

    },
    
    get_app_id: function() {
        return this.app.get_id();
    },
    
    getDragActor: function() {
        return new Clutter.Clone({ source: this.actor });
    },

    // Returns the original actor that should align with the actor
    // we show as the item is being dragged.
    getDragActorSource: function() {
        return this.actor;
    }
};


function FavoritesBox() {
    this._init();
}

FavoritesBox.prototype = {
    _init: function() {
        this.actor = new St.BoxLayout({ vertical: true });
        this.actor._delegate = this;
        
        this._dragPlaceholder = null;
        this._dragPlaceholderPos = -1;
        this._animatingPlaceholdersCount = 0;
    },
    
    _clearDragPlaceholder: function() {
        if (this._dragPlaceholder) {
            this._dragPlaceholder.animateOutAndDestroy();
            this._dragPlaceholder = null;
            this._dragPlaceholderPos = -1;
        }
    },
    
    handleDragOver : function(source, actor, x, y, time) {
        let app = source.app;

        // Don't allow favoriting of transient apps
        if (app == null || app.is_window_backed() || (!(source instanceof FavoritesButton) && app.get_id() in AppFavorites.getAppFavorites().getFavoriteMap()))
            return DND.DragMotionResult.NO_DROP;

        let favorites = AppFavorites.getAppFavorites().getFavorites();
        let numFavorites = favorites.length;

        let favPos = favorites.indexOf(app);

        let children = this.actor.get_children();
        let numChildren = children.length;
        let boxHeight = this.actor.height;

        // Keep the placeholder out of the index calculation; assuming that
        // the remove target has the same size as "normal" items, we don't
        // need to do the same adjustment there.
        if (this._dragPlaceholder) {
            boxHeight -= this._dragPlaceholder.actor.height;
            numChildren--;
        }

        let pos = Math.round(y * numFavorites / boxHeight);

        if (pos != this._dragPlaceholderPos && pos <= numFavorites) {
            if (this._animatingPlaceholdersCount > 0) {
                let appChildren = children.filter(function(actor) {
                    return (actor._delegate instanceof FavoritesButton);
                });
                this._dragPlaceholderPos = children.indexOf(appChildren[pos]);
            } else {
                this._dragPlaceholderPos = pos;
            }

            // Don't allow positioning before or after self
            if (favPos != -1 && (pos == favPos || pos == favPos + 1)) {
                if (this._dragPlaceholder) {
                    this._dragPlaceholder.animateOutAndDestroy();
                    this._animatingPlaceholdersCount++;
                }
                this._dragPlaceholder = null;

                return DND.DragMotionResult.CONTINUE;
            }

            // If the placeholder already exists, we just move
            // it, but if we are adding it, expand its size in
            // an animation
            let fadeIn;
            if (this._dragPlaceholder) {
                this._dragPlaceholder.actor.destroy();
                fadeIn = false;
            } else {
                fadeIn = true;
            }

            this._dragPlaceholder = new DND.GenericDragPlaceholderItem();
            this._dragPlaceholder.child.set_height (source.actor.height);
            this.actor.insert_actor(this._dragPlaceholder.actor,
                                   this._dragPlaceholderPos);
            if (fadeIn)
                this._dragPlaceholder.animateIn();
        }

        let srcIsFavorite = (favPos != -1);

        if (srcIsFavorite)
            return DND.DragMotionResult.MOVE_DROP;

        return DND.DragMotionResult.COPY_DROP;
    },
    
    // Draggable target interface
    acceptDrop : function(source, actor, x, y, time) {
        let app = source.app;

        // Don't allow favoriting of transient apps
        if (app == null || app.is_window_backed()) {
            return false;
        }

        let id = app.get_id();

        let favorites = AppFavorites.getAppFavorites().getFavoriteMap();

        let srcIsFavorite = (id in favorites);

        let favPos = 0;
        let children = this.actor.get_children();
        for (let i = 0; i < this._dragPlaceholderPos; i++) {
            if (this._dragPlaceholder &&
                children[i] == this._dragPlaceholder.actor)
                continue;
            
            if (!(children[i]._delegate instanceof FavoritesButton)) continue;

            let childId = children[i]._delegate.app.get_id();
            if (childId == id)
                continue;
            if (childId in favorites)
                favPos++;
        }

        Meta.later_add(Meta.LaterType.BEFORE_REDRAW, Lang.bind(this,
            function () {
                let appFavorites = AppFavorites.getAppFavorites();
                if (srcIsFavorite)
                    appFavorites.moveFavoriteToPos(id, favPos);
                else
                    appFavorites.addFavoriteAtPos(id, favPos);
                return false;
            }));

        return true;
    }
}

function MyApplet(orientation) {
    this._init(orientation);
}

MyApplet.prototype = {
    __proto__: Applet.TextIconApplet.prototype,

    _init: function(orientation) {        
        Applet.TextIconApplet.prototype._init.call(this, orientation);
        
        try {                    
            this.set_applet_tooltip(_("Favorites"));
	    this.set_applet_icon_symbolic_name("starred");
                                    
            this.menuManager = new PopupMenu.PopupMenuManager(this);
            this.menu = new Applet.AppletPopupMenu(this, orientation);
            this.menuManager.addMenu(this.menu);  

	    

            this.menu.connect('open-state-changed', Lang.bind(this, this._onOpenStateChanged));                                
                                    
            this._favoritesButtons = new Array();
            this._selectedItemIndex = null;
            this._previousSelectedItemIndex = null;
            this._activeContainer = null;

            this._display();

            AppFavorites.getAppFavorites().connect('changed', Lang.bind(this, this._refreshFavs));
            
            
            this.hover_delay = global.settings.get_int("menu-hover-delay") / 1000;
            global.settings.connect("changed::menu-hover-delay", Lang.bind(this, function() {
                    this.hover_delay = global.settings.get_int("menu-hover-delay") / 1000;
            })); 

	    let icon = new St.Icon({icon_name: "gnome-settings", icon_size: 16, icon_type: St.IconType.FULLCOLOR});
			this.computerItem = new MyContextMenuItem(icon, _("Favorites Applet Settings"));
			
			this._applet_context_menu.addMenuItem(this.computerItem);
			this.computerItem.connect('activate', function(actor, event) {
                Main.Util.spawnCommandLine(AppletDir + "/settings.py");
			});
                
            global.display.connect('overlay-key', Lang.bind(this, function(){
                try{
                    this.menu.toggle();
                }
                catch(e) {
                    global.logError(e);
                }
            }));    
            
                                                                           
        }
        catch (e) {
            global.logError(e);
        }
    },
    
    on_orientation_changed: function (orientation) {
        this.menu.destroy();
        this.menu = new Applet.AppletPopupMenu(this, orientation);
        this.menuManager.addMenu(this.menu);

        this.menu.connect('open-state-changed', Lang.bind(this, this._onOpenStateChanged));
        
        this._display();
    },
    
    on_applet_clicked: function(event) {
        this.menu.toggle();     
    },        
           
    _onOpenStateChanged: function(menu, open) {
        if (open) {
            this.actor.add_style_pseudo_class('active');            
		}
        
    },

    destroy: function() {
        this.actor._delegate = null;
        this.menu.destroy();
        this.actor.destroy();
        this.emit('destroy');
    },
    
   
    
    _refreshFavs : function() {     	
    	//Remove all favorites
    	this.leftBox.get_children().forEach(Lang.bind(this, function (child) {
            child.destroy();
        }));
        
        let favoritesBox = new FavoritesBox();
        this.leftBox.add_actor(favoritesBox.actor);
    	 
        //Load favorites again
        this._favoritesButtons = new Array();
        let launchers = global.settings.get_strv('favorite-apps');
        let appSys = Cinnamon.AppSystem.get_default();
        let j = 0;
        for ( let i = 0; i < launchers.length; ++i ) {
            let app = appSys.lookup_app(launchers[i]);
            if (!app) app = appSys.lookup_settings_app(launchers[i]);
            if (app) {
                let button = new FavoritesButton(this, app, launchers.length +3); // + 3 because we're adding 3 system buttons at the bottom
                this._favoritesButtons[app] = button;
                favoritesBox.actor.add_actor(button.actor, { });
                button.actor.connect('enter-event', Lang.bind(this, function() {
                   this.selectedAppTitle.set_text(button.app.get_name());
                   if (button.app.get_description()) this.selectedAppDescription.set_text(button.app.get_description());
                   else this.selectedAppDescription.set_text("");
                }));
                button.actor.connect('leave-event', Lang.bind(this, function() {
                   this.selectedAppTitle.set_text("");
                   this.selectedAppDescription.set_text("");
                }));
                ++j;
            }
        }

               
    },
   
    _display : function() {
        this._activeContainer = null;
        let section = new PopupMenu.PopupMenuSection();
        this.menu.addMenuItem(section);
        
        let leftPane = new St.BoxLayout({ vertical: true });
	this.leftBox = new St.BoxLayout({ vertical: true });
        this._session = new GnomeSession.SessionManager();
        this._screenSaverProxy = new ScreenSaver.ScreenSaverProxy();            
                                       
        leftPane.add_actor(this.leftBox, { y_align: St.Align.END, y_fill: false });        
                     
        this._refreshFavs();
                                                          
        this.mainBox = new St.BoxLayout({ vertical: true });       
                
        this.mainBox.add_actor(leftPane);

        section.actor.add_actor(this.mainBox);
        
		this.applicationsByCategory = {};           
    },
    
    
    closeApplicationsContextMenus: function(excludeApp, animate) {
        for (var app in this._applicationsButtons){
            if (app!=excludeApp && this._applicationsButtons[app].menu.isOpen){
                if (animate)
                    this._applicationsButtons[app].toggleMenu();
                else
                    this._applicationsButtons[app].closeMenu();
            }
        }
    },
    
 
};

function main(metadata, orientation) {  
    let myApplet = new MyApplet(orientation);
    return myApplet;      
}
