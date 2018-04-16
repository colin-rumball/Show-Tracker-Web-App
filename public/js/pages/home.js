function findAncestor(el, cls) {
	while ((el = el.parentElement) && !el.classList.contains(cls));
	return el;
}

$(function() {
	$('.remove-button').click(function() {
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
			url: '/show/add/' + id,
			type: 'POST'
		});
	});

	$('#add-show-form').submit(function (e) {
		e.preventDefault();

		var showName = $('#search-show-name').val();
		var url = 'http://api.tvmaze.com/search/shows?q=' + encodeURIComponent(showName);

		$('#results-modal').modal('toggle');
		$('#search-modal').modal('toggle');

		$.ajax({
			url: url,
			type: 'GET',
			success: function (data) {
				$('#new-show-results-container').html('');
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