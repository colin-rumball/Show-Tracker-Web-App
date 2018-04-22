function findAncestor(el, cls) {
	while ((el = el.parentElement) && !el.classList.contains(cls));
	return el;
}

$(function() {
	// NAV BUTTONS
	$('.dropdown-item').click(function () {
		var id = this.dataset.show_id;
		var dropdown = findAncestor(this, 'dropdown');
		var dropdownSelector = dropdown.getElementsByClassName('nav-show-selection')[0];

		dropdownSelector.innerHTML = this.textContent;
		document.getElementById('episodes-container').innerHTML = '';

		$.ajax({
			type: "GET",
			url: '/public/templates/episode.hbs',
			success: function (episodeTemplate) {
				$.ajax({
					type: "GET",
					url: '/show/' + id.toString() + '/episodes.json',
					success: function (data) {
						var episodeFunc = Handlebars.compile(episodeTemplate);
						for (var i = 0; i < data.length; i++) {
							document.getElementById('episodes-container').innerHTML += episodeFunc(data[i]);
						}
					}
				});
			}
		});
	});

	$('#force-update-button').click(function() {
		$.ajax({
			type: "POST",
			url: '/update',
			success: function () {
				location.href = '/';
				alert('Update complete');
			},
			error: function() {
				alert('Update failed');
			}
		});
	});

	$('#post-processing-button').click(function() {
		$.ajax({
			type: "POST",
			url: '/post-processing',
			success: function () {
				location.href = '/';
			}
		});
	});

	// EPISODE STUFF ( DOWNLOAD / REMOVE )

	$('#episodes-container').on('click', '.download-button', function () {
		$('#torrent-results-container').html('Searching...');
		var id = this.dataset.episode_id;
		var thisButton = this;
		$('#torrent-results-modal').data('episode_id', id);
		$.ajax({
			type: "GET",
			url: '/episode/torrents/' + id.toString(),
			success: function (torrents) {
				if (torrents != null && torrents != "") {
					$('#torrent-results-container').html('');
					$.ajax({
						type: "GET",
						url: '/public/templates/torrent.hbs',
						success: function (torrentTemplate) {
							var torrentFunc = Handlebars.compile(torrentTemplate);
							for (var i = 0; i < torrents.length; i++) {
								$('#torrent-results-container').append(torrentFunc(torrents[i]));
							}
							$(thisButton).toggleClass('btn-success');
						}
					});
				}
				else {
					$('#torrent-results-container').html('No results found.');
				}
			}
		});
	});

	$('#episodes-container').on('click', '.remove-button', function () {
		var episodeContainer = findAncestor(this, 'episode');
		var id = this.dataset.episode_id;
		$.ajax({
			type: "DELETE",
			url: '/episode/' + id.toString(),
			success: function(data) {
				$(episodeContainer).fadeOut(500);
			}
		});
	});

	//// MODAL ACTIONS

	// Season Selection
	$('#new-show-results-container').on('click', '.season-dropdown-item', function () {
		var id = this.dataset.season_id;
		var showContainer = findAncestor(this, 'modal-list-item-info');
		var addButton = showContainer.getElementsByClassName('new-show-button')[0];
		addButton.dataset.season_id = id;
		addButton.classList.remove('disabled');

		var dropDownContainer = findAncestor(this, 'dropdown');
		var dropDownButton = showContainer.getElementsByClassName('dropdown-toggle')[0];
		dropDownButton.innerHTML = (id == 0 ? 'All' : 'Season ' + id);
	});
	// Add Show
	$('#new-show-results-container').on('click', '.new-show-button', function () {
		var id = this.dataset.show_id;
		var season = this.dataset.season_id;
		$.ajax({
			url: '/show/' + id,
			type: 'POST',
			data: { season },
			success: function(data) {
				location.href = '/show/' + data.name;
			}			
		});
	});
	// Torrent Selection
	$('#torrent-results-container').on('click', '.torrent-selection-button', function () {
		var id = $('#torrent-results-modal').data('episode_id');
		var data = { link: this.dataset.magnet, episode_id: id};
		$.ajax({
			url: '/torrents',
			type: 'POST',
			data: data,
			success: function() {
				alert('Torrent added!');
			},
			error: function() {
				alert('Error adding torrent to downloader');
			}
		});
	});

	// NEW SHOW QUERY / FORM

	$('#add-show-form').submit(function (e) {
		e.preventDefault();

		var showName = $('#search-show-name').val();
		var url = 'http://api.tvmaze.com/search/shows?q=' + encodeURIComponent(showName);

		$('#results-modal').modal('toggle');
		$('#search-modal').modal('toggle');

		$('#new-show-results-container').html('');

		$.when(
			$.ajax({
				type: "GET",
				url: '/public/templates/new-show.hbs'
			}),
			$.ajax({
				url: url,
				type: 'GET'
			})
		)
		.done(function (returnedShowTemplate, searchResults) {
			$('#search-show-name').val('');
			var showFunc = Handlebars.compile(returnedShowTemplate[0]);
			for (var i = 0; i < searchResults[0].length; i++) {
				AddShowResult(searchResults[0][i].show, showFunc);
			}
		})
	});
});

function AddShowResult(show, showFunc) {
	$.ajax({
		type: "GET",
		url: 'http://api.tvmaze.com/shows/' + show.id + '/seasons',
		success: function (seasons) {
			show.seasons = seasons;
			$('#new-show-results-container').append(showFunc(show));
		}
	});
}