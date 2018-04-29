function OnNewRequest(title, text) {
    $('#request-modal').modal('toggle');
    $('#circle-spinner').removeClass('invisible');
    $('#request-success').addClass('invisible');
    $('#request-failure').addClass('invisible');
    $('#request-modal-label').html(title);
    $('#request-text').html(text);
}

function OnRequestSuccessful(text) {
    $('#circle-spinner').addClass('invisible');
    $('#request-success').removeClass('invisible');
    $('#request-text').html(text);
}

function OnRequestFailure(text) {
    $('#circle-spinner').addClass('invisible');
    $('#request-failure').removeClass('invisible');
    $('#request-text').html(text);
}