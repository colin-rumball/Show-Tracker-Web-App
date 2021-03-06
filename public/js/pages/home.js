function findAncestor(el, cls) {
	while ((el = el.parentElement) && !el.classList.contains(cls));
	return el;
}

var CurrentEpisode;

$(function() {
	// NAV BUTTONS
	$('.dropdown-show').click(function () {
		window.location.href = `/show/${this.textContent}`;
		// var id = this.dataset.show_id;
		// var dropdown = findAncestor(this, 'dropdown');
		// var dropdownSelector = dropdown.getElementsByClassName('nav-show-selection')[0];

		// dropdownSelector.innerHTML = this.textContent;
		// document.getElementById('episodes-container').innerHTML = '';

		// $.ajax({
		// 	type: "GET",
		// 	url: '/public/templates/episode.hbs',
		// 	success: function (episodeTemplate) {
		// 		fetch('/show/' + id.toString() + '/episodes.json').then(function (response){
		// 			if (response.ok) {
		// 				response.json().then(function (data) {
		// 					var episodes = data.episodes;
		// 					var shows = data.shows;
		// 					var episodeFunc = Handlebars.compile(episodeTemplate);
		// 					for (var i = 0; i < episodes.length; i++) {
		// 						episodes[i].show.image_url = shows.find(show => show.api_id === episodes[i].show.api_id).image_url;
		// 						document.getElementById('episodes-container').innerHTML += episodeFunc(episodes[i]);
		// 					}
		// 				});
		// 			}
					
		// 		});
		// 	}
		// });
	});

	$('#force-update-button').click(function() {
		OnNewRequest('Updating Database Info', 'Updating all shows and episodes with new info...');
		$.ajax({
			type: "POST",
			url: '/update-all',
			success: function () {
				OnRequestSuccessful('All info updated successfully!');
			},
			error: function(err) {
				OnRequestFailure('An error occurred while updating database info: ' + err.responseText);
			}
		});
	});

	$('#episode-update-button').click(function () {
		OnNewRequest('Updating Episode Info', 'Updating episodes that have not been removed with new info...');
		$.ajax({
			type: "POST",
			url: '/update-episodes',
			success: function () {
				OnRequestSuccessful('All info updated successfully!');
			},
			error: function (err) {
				OnRequestFailure('An error occurred while updating database info: ' + err.responseText);
			}
		});
	});

	$('#post-processing-button').click(function() {
		OnNewRequest('Processing New Files', 'Attempting to move completed downloads to Plex...');
		$.ajax({
			type: "POST",
			url: '/post-processing',
			success: function (arr) {
				var message;
				if (arr != null && arr.length > 0) {
					message = 'Files moved successfully: <ul>';
					for (var i = 0; i < arr.length; i++)
					{
						if (arr[i].id != null) {
							var episodeContainer = $('#episode_' + arr[i].id);
							if (episodeContainer) {
								$(episodeContainer).fadeOut(500);
							}
						}
						message += `<li>${arr[i].message}</li>`;
					}
					message += '</ul>';
				} else {
					message = 'No files were available to move.'
				}
				OnRequestSuccessful(message);
			},
			error: function (err) {
				OnRequestFailure('An error occurred while processing new files. Error: ' + err.responseText);
			}
		});
	});

	// EPISODE STUFF ( DOWNLOAD / REMOVE )

	$('#episodes-container').on('click', '.download-button', function () {
		CurrentEpisode = findAncestor(this, 'episode');
		$('#torrent-results-container').html('Searching...');
		var id = this.dataset.episode_id;
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
		dropDownButton.innerHTML =this.innerHTML;
	});

	// Add Show
	$('#new-show-results-container').on('click', '.new-show-button', function () {
		OnNewRequest('Adding New Show', 'Adding new show and episodes to the database...');
		var id = this.dataset.show_id;
		var season = this.dataset.season_id;
		$.ajax({
			url: '/show/' + id,
			type: 'POST',
			data: { season },
			success: function(data) {
				OnRequestSuccessful('Show and episodes added successfully!');
			},
			error: function (err) {
				OnRequestFailure('An error occurred while adding the new show. Error: ' + err.responseText);
			}	
		});
	});

	// Torrent Selection
	$('#torrent-results-container').on('click', '.torrent-selection-button', function () {
		OnNewRequest('Adding New Torrent', 'Attempting to add new torrent to download queue...');
		var id = $('#torrent-results-modal').data('episode_id');
		var data = { link: this.dataset.magnet, episode_id: id};
		$.ajax({
			url: '/torrents',
			type: 'POST',
			data: data,
			success: function () {
				CurrentEpisode.classList.add('downloaded');
				OnRequestSuccessful('Torrent added successfully!');
			},
			error: function (err) {
				OnRequestFailure('An error occurred while adding the new torrent. Error: ' + err.responseText);
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