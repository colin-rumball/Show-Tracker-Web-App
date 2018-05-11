$(function() {
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
});