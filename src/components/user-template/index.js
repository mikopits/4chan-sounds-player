const buttons = require('./buttons');

// Regex for replacements
const playingRE = /p: ?{([^}]*)}/g;
const hoverRE = /h: ?{([^}]*)}/g;
const buttonRE = new RegExp(`(${buttons.map(option => option.tplName).join('|')})-(?:button|link)(?:\\:"([^"]+?)")?`, 'g');
const soundNameRE = /sound-name/g;
const soundIndexRE = /sound-index/g;
const soundCountRE = /sound-count/g;

// Hold information on which config values components templates depend on.
const componentDeps = [ ];

module.exports = {
	buttons,

	delegatedEvents: {
		click: {
			[`.${ns}-playing-jump-link`]: () => Player.playlist.scrollToPlaying('center'),
			[`.${ns}-viewStyle-button`]: 'playlist.toggleView',
			[`.${ns}-hoverImages-button`]: 'playlist.toggleHoverImages',
			[`.${ns}-remove-link`]: 'userTemplate._handleRemove',
			[`.${ns}-filter-link`]: 'userTemplate._handleFilter',
			[`.${ns}-download-link`]: 'userTemplate._handleDownload',
			[`.${ns}-shuffle-button`]: 'userTemplate._handleShuffle',
			[`.${ns}-repeat-button`]: 'userTemplate._handleRepeat',
			[`.${ns}-reload-button`]: noDefault('playlist.refresh'),
			[`.${ns}-add-button`]: noDefault(() => Player.$(`.${ns}-file-input`).click()),
			[`.${ns}-item-menu-button`]: 'userTemplate._handleMenu',
			[`.${ns}-threads-button`]: 'threads.toggle',
			[`.${ns}-config-button`]: 'settings.toggle'
		},
		change: {
			[`.${ns}-file-input`]: 'userTemplate._handleFileSelect'
		}
	},

	undelegatedEvents: {
		click: {
			body: 'userTemplate._closeMenus'
		},
		keydown: {
			body: e => e.key === 'Escape' && Player.userTemplate._closeMenus()
		}
	},

	initialize: function () {
		Player.on('config', Player.userTemplate._handleConfig);
		Player.on('playsound', () => Player.userTemplate._handleEvent('playsound'));
		Player.on('add', () => Player.userTemplate._handleEvent('add'));
		Player.on('remove', () => Player.userTemplate._handleEvent('remove'));
		Player.on('order', () => Player.userTemplate._handleEvent('order'));
		Player.on('show', () => Player.userTemplate._handleEvent('show'));
		Player.on('hide', () => Player.userTemplate._handleEvent('hide'));
	},

	/**
	 * Build a user template.
	 */
	build: function (data) {
		const outerClass = data.outerClass || '';
		const name = data.sound && data.sound.title || data.defaultName;

		// Apply common template replacements
		let html = data.template
			.replace(playingRE, Player.playing && Player.playing === data.sound ? '$1' : '')
			.replace(hoverRE, `<span class="${ns}-hover-display ${outerClass}">$1</span>`)
			.replace(buttonRE, function (full, type, text) {
				let buttonConf = buttons.find(conf => conf.tplName === type);
				if (buttonConf.requireSound && !data.sound || buttonConf.showIf && !buttonConf.showIf(data)) {
					return '';
				}
				// If the button config has sub values then extend the base config with the selected sub value.
				// Which value is to use is taken from the `property` in the base config of the player config.
				// This gives us different state displays.
				if (buttonConf.values) {
					buttonConf = {
						...buttonConf,
						...buttonConf.values[_get(Player.config, buttonConf.property)] || buttonConf.values[Object.keys(buttonConf.values)[0]]
					};
				}
				const attrs = typeof buttonConf.attrs === 'function' ? buttonConf.attrs(data) : buttonConf.attrs || [];
				attrs.some(attr => attr.startsWith('href')) || attrs.push('href=javascript:;');
				(buttonConf.class || outerClass) && attrs.push(`class="${buttonConf.class || ''} ${outerClass || ''}"`);

				if (!text) {
					text = buttonConf.icon
						? `<span class="fa ${buttonConf.icon}">${buttonConf.text}</span>`
						: buttonConf.text;
				}

				return `<a ${attrs.join(' ')}>${text}</a>`;
			})
			.replace(soundNameRE, name ? `<div class="fc-sounds-col fc-sounds-truncate-text"><span title="${name}">${name}</span></div>` : '')
			.replace(soundIndexRE, data.sound ? Player.sounds.indexOf(data.sound) + 1 : 0)
			.replace(soundCountRE, Player.sounds.length)
			.replace(/%v/g, VERSION);

		// Apply any specific replacements
		if (data.replacements) {
			for (let k of Object.keys(data.replacements)) {
				html = html.replace(new RegExp(k, 'g'), data.replacements[k]);
			}
		}

		return html;
	},

	/**
	 * Sets up a components to render when the template or values within it are changed.
	 */
	maintain: function (component, property, alwaysRenderConfigs = [], alwaysRenderEvents = []) {
		componentDeps.push({
			component,
			property,
			...Player.userTemplate.findDependencies(property, null),
			alwaysRenderConfigs,
			alwaysRenderEvents
		});
	},

	/**
	 * Find all the config dependent values in a template.
	 */
	findDependencies: function (property, template) {
		template || (template = _get(Player.config, property));
		// Figure out what events should trigger a render.
		const events = [];

		// add/remove should render templates showing the count.
		// playsound should render templates showing the playing sounds name/index or dependent on something playing.
		// order should render templates showing a sounds index.
		const hasCount = soundCountRE.test(template);
		const hasName = soundNameRE.test(template);
		const hasIndex = soundIndexRE.test(template);
		const hasPlaying = playingRE.test(template);
		hasCount && events.push('add', 'remove');
		(hasPlaying || property !== 'rowTemplate' && (hasName || hasIndex)) && events.push('playsound');
		hasIndex && events.push('order');

		// Find which buttons the template includes that are dependent on config values.
		const config = [];
		let match;
		while ((match = buttonRE.exec(template)) !== null) {
			// If user text is given then the display doesn't change.
			if (!match[2]) {
				let type = match[1];
				let buttonConf = buttons.find(conf => conf.tplName === type);
				if (buttonConf.property) {
					config.push(buttonConf.property);
				}
			}
		}

		return { events, config };
	},

	/**
	 * When a config value is changed check if any component dependencies are affected.
	 */
	_handleConfig: function (property, value) {
		// Check if a template for a components was updated.
		componentDeps.forEach(depInfo => {
			if (depInfo.property === property) {
				Object.assign(depInfo, Player.userTemplate.findDependencies(property, value));
				depInfo.component.render();
			}
		});
		// Check if any components are dependent on the updated property.
		componentDeps.forEach(depInfo => {
			if (depInfo.alwaysRenderConfigs.includes(property) || depInfo.config.includes(property)) {
				depInfo.component.render();
			}
		});
	},

	/**
	 * When a player event is triggered check if any component dependencies are affected.
	 */
	_handleEvent: function (type) {
		// Check if any components are dependent on the updated property.
		componentDeps.forEach(depInfo => {
			if (depInfo.alwaysRenderEvents.includes(type) || depInfo.events.includes(type)) {
				depInfo.component.render();
			}
		});
	},

	/**
	 * Add local files.
	 */
	_handleFileSelect: function (e) {
		e.preventDefault();
		const input = e.eventTarget;
		Player.playlist.addFromFiles(input.files);
	},

	/**
	 * Toggle the repeat style.
	 */
	_handleRepeat: function (e) {
		try {
			e.preventDefault();
			const values = [ 'all', 'one', 'none' ];
			const current = values.indexOf(Player.config.repeat);
			Player.set('repeat', values[(current + 4) % 3]);
		} catch (err) {
			_logError('There was an error changing the repeat setting. Please check the console for details.', 'warning');
			console.error('[4chan sounds player]', err);
		}
	},

	/**
	 * Toggle the shuffle style.
	 */
	_handleShuffle: function (e) {
		try {
			e.preventDefault();
			Player.set('shuffle', !Player.config.shuffle);
			Player.header.render();

			// Update the play order.
			if (!Player.config.shuffle) {
				Player.sounds.sort((a, b) => Player.compareIds(a.id, b.id));
			} else {
				const sounds = Player.sounds;
				for (let i = sounds.length - 1; i > 0; i--) {
					const j = Math.floor(Math.random() * (i + 1));
					[ sounds[i], sounds[j] ] = [ sounds[j], sounds[i] ];
				}
			}
			Player.trigger('order');
		} catch (err) {
			_logError('There was an error changing the shuffle setting. Please check the console for details.', 'warning');
			console.error('[4chan sounds player]', err);
		}
	},

	/**
	 * Display an item menu.
	 */
	_handleMenu: function (e) {
		e.preventDefault();
		e.stopPropagation();
		const x = e.clientX;
		const y = e.clientY;
		const id = e.eventTarget.getAttribute('data-id');
		const sound = Player.sounds.find(s => s.id === id);

		// Add row item menus to the list container. Append to the container otherwise.
		const listContainer = e.eventTarget.closest(`.${ns}-list-container`);
		const parent = listContainer || Player.container;

		// Create the menu.
		const dialog = createElement(Player.templates.itemMenu({ x, y, sound }), parent);

		parent.appendChild(dialog);

		// Make sure it's within the page.
		const style = document.defaultView.getComputedStyle(dialog);
		const width = parseInt(style.width, 10);
		const height = parseInt(style.height, 10);
		// Show the dialog to the left of the cursor, if there's room.
		if (x - width > 0) {
			dialog.style.left = x - width + 'px';
		}
		// Move the dialog above the cursor if it's off screen.
		if (y + height > document.documentElement.clientHeight - 40) {
			dialog.style.top = y - height + 'px';
		}
		// Add the focused class handler
		dialog.querySelectorAll('.entry').forEach(el => {
			el.addEventListener('mouseenter', Player.userTemplate._setFocusedMenuItem);
			el.addEventListener('mouseleave', Player.userTemplate._unsetFocusedMenuItem);
		});

		Player.trigger('menu-open', dialog);
	},

	/**
	 * Close any open menus, except for one belonging to an item that was clicked.
	 */
	_closeMenus: function () {
		document.querySelectorAll(`.${ns}-item-menu`).forEach(menu => {
			menu.parentNode.removeChild(menu);
			Player.trigger('menu-close', menu);
		});
	},

	_setFocusedMenuItem: function (e) {
		e.currentTarget.classList.add('focused');
		const submenu = e.currentTarget.querySelector('.submenu');
		// Move the menu to the other side if there isn't room.
		if (submenu && submenu.getBoundingClientRect().right > document.documentElement.clientWidth) {
			submenu.style.inset = '0px auto auto -100%';
		}
	},

	_unsetFocusedMenuItem: function (e) {
		e.currentTarget.classList.remove('focused');
	},

	_handleFilter: function (e) {
		e.preventDefault();
		let filter = e.eventTarget.getAttribute('data-filter');
		if (filter) {
			Player.set('filters', Player.config.filters.concat(filter));
		}
	},

	_handleDownload: function (e) {
		const src = e.eventTarget.getAttribute('data-src');
		const name = e.eventTarget.getAttribute('data-name') || new URL(src).pathname.split('/').pop();

		GM.xmlHttpRequest({
			method: 'GET',
			url: src,
			responseType: 'blob',
			onload: response => {
				const a = createElement(`<a href="${URL.createObjectURL(response.response)}" download="${name}" rel="noopener" target="_blank"></a>`);
				a.click();
				URL.revokeObjectURL(a.href);
			},
			onerror: () => _logError('There was an error downloading.', 'warning')
		});
	},

	_handleRemove: function (e) {
		const id = e.eventTarget.getAttribute('data-id');
		const sound = id && Player.sounds.find(sound => sound.id === '' + id);
		sound && Player.remove(sound);
	},
};
