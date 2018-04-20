$(function() {
	$('.remove-show-button').click(function() {
		var mongo_id = this.dataset.show_id;
		$.ajax({
			type: "DELETE",
			url: '/show/' + mongo_id.toString(),
			success: function (data) {
				window.location.href = '/';
			}
		});
	});
});