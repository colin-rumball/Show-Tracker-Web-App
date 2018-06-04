$(function() {
	$('#pause-all-button').click(function () {
		fetch('/torrent-controls', {
			method: 'post',
			body: JSON.stringify({
				command: 'pause'
			}),
			headers: {
				'content-type': 'application/json'
			},
			mode: 'cors',
			cache: 'default'
		});
	});

	$('#play-all-button').click(function () {
		fetch('/torrent-controls', {
			method: 'post',
			body: JSON.stringify({command: 'play'}),
			headers: {
				'content-type': 'application/json'
			},
			mode: 'cors',
			cache: 'default'
		});
	});

	$('#add-movie-button').click(function () {
		$('#add-movie-modal').modal('toggle');
	});

	$('#add-torrent-url-button').click(function() {
		$('#add-movie-modal').modal('toggle');
		var link = $('#new-movie-magnet-link')[0].value;
		if (link != '') {
			OnNewRequest('Adding New Movie', 'Attempting to add new movie to download queue...');
			var data = { link: link};
			$.ajax({
				url: '/movie-torrents',
				type: 'POST',
				data: data,
				success: function () {
					OnRequestSuccessful('Movie added successfully!');
				},
				error: function (err) {
					OnRequestFailure('An error occurred while adding the new movie. Error: ' + err.responseText);
				}
			});
		}
	});

	if (!!window.EventSource) {
		var source = new EventSource('/torrents-stream')
		var torrentTemplateFunc;

		fetch('/public/templates/listed_torrent.hbs').then(function (response) {
			if (response.ok) {
				response.text().then((torrentTemplate) => {
					torrentTemplateFunc = Handlebars.compile(torrentTemplate);
				});
			}
		});

		source.addEventListener('message', function (e) {
			$("#torrents-table-body").html();

			if (torrentTemplateFunc != undefined) {
				var torrentArray = JSON.parse(e.data);
				var newHtml = "";
				for (var i = 0; i < torrentArray.length; i++)
				{
					newHtml += torrentTemplateFunc(torrentArray[i]);
				}
				$("#torrents-table-body").html(newHtml);
			}
		}, false);

		source.addEventListener('open', function (e) {
			console.log("Connected");
		}, false);

		source.addEventListener('error', function (e) {
			source.close();
		}, false);
	}
});