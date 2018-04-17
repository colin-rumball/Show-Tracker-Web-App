function findAncestor(el, cls) {
	while ((el = el.parentElement) && !el.classList.contains(cls));
	return el;
}

$(function() {
	$('#episodes-container').on('click', '.download-button', function () {
		$('#new-show-results-container').html('Searching...');
		var id = this.dataset.episode_id;
		$.ajax({
			type: "GET",
			url: '/torrents/' + id.toString(),
			success: function (torrents) {
				if (torrents != null && torrents != "") {
					$('#new-show-results-container').html('');
					$.ajax({
						type: "GET",
						url: '/public/templates/torrent.hbs',
						success: function (torrentTemplate) {
							var torrentFunc = Handlebars.compile(torrentTemplate);
							for (var i = 0; i < torrents.length; i++) {
								$('#new-show-results-container').append(torrentFunc(torrents[i]));
							}
						}
					});
				}
				else {
					$('#new-show-results-container').html('No results returned.');
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

	$('.dropdown-item').click(function () {
		var showName = this.textContent;
		var id = this.dataset.show_id;
		document.getElementById('episodes-container').innerHTML = '';

		$.ajax({
			type: "GET",
			url: '/public/templates/episode.hbs',
			success: function (episodeTemplate) {
				$.ajax({
					type: "GET",
					url: '/show/' + id.toString(),
					success: function (data) {
						$('#showing-text').html('Showing: ' + showName);
						var episodeFunc = Handlebars.compile(episodeTemplate);
						for (var i = 0; i < data.length; i++) {
							document.getElementById('episodes-container').innerHTML += episodeFunc(data[i]);
						}
					}
				});
			}
		});
	});

	$('#new-show-results-container').on('click', '.new-show-button', function () {
		var id = this.dataset.show_id;
		$.ajax({
			url: '/show/' + id,
			type: 'POST'
		});
	});

	$('#new-show-results-container').on('click', '.torrent-selection-button', function () {
		var link = {link: this.dataset.magnet};
		var thisButton = this;
		$.ajax({
			url: '/download',
			type: 'POST',
			data: link,
			success: function() {
				alert('Added torrent to downloader');
			}
		});
	});

	$('#add-show-form').submit(function (e) {
		e.preventDefault();

		var showName = $('#search-show-name').val();
		var url = 'http://api.tvmaze.com/search/shows?q=' + encodeURIComponent(showName);

		$('#results-modal').modal('toggle');
		$('#search-modal').modal('toggle');

		$('#new-show-results-container').html('');

		$.ajax({
			url: url,
			type: 'GET',
			success: function (data) {
				$.ajax({
					type: "GET",
					url: '/public/templates/new-show.hbs',
					success: function (newShowTemplate) {
						var showFunc = Handlebars.compile(newShowTemplate);
						for (var i = 0; i < data.length; i++) {
							var show = data[i].show;
							$('#new-show-results-container').append(showFunc(show));
						}
					}
				});
			}
		})
	});
});