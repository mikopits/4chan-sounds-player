`<div class="${ns}-menu dialog" id="menu" tabindex="0" data-type="post" style="position: fixed;">
	<a class="${ns}-remove-link entry focused" href="javascript:;" data-id="${data.sound.id}">Remove</a>
	${data.sound.post ? `<a class="entry" href="#${data.postIdPrefix + data.sound.post}">Show Post</a>` : ''}
	<div class="entry has-submenu">
		Open
		<div class="dialog submenu" style="inset: 0px auto auto 100%;">
			<a class="entry" href="${data.sound.image}" target="_blank">Image</a>
			<a class="entry" href="${data.sound.src}" target="_blank">Sound</a>
		</div>
	</div>
	<div class="entry has-submenu">
		Download
		<div class="dialog submenu" style="inset: 0px auto auto 100%;">
			<a class="${ns}-download-link entry" href="javascript:;" data-src="${data.sound.image}" data-name="${data.sound.filename}">Image</a>
			<a class="${ns}-download-link entry" href="javascript:;" data-src="${data.sound.src}" data-name="${data.sound.name}">Sound</a>
		</div>
	</div>
	<div class="entry has-submenu">
		Filter
		<div class="dialog submenu" style="inset: 0px auto auto 100%;">
			${data.sound.imageMD5 ? `<a class="${ns}-filter-link entry" href="javascript:;" data-filter="${data.sound.imageMD5}">Image</a>` : ''}
			<a class="${ns}-filter-link entry" href="javascript:;" data-filter="${data.sound.src.replace(/^(https?\:)?\/\//, '')}">Sound</a>
		</div>
	</div>
</div>`