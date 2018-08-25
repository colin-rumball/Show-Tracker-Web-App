function signIn() {
    let username = $("#username").val();
    let password = $("#password").val();
    chrome.runtime.sendMessage(
        {username, password}, 
        (success) =>
        {
            if (success)
            {
                window.close();
            }
            else
            {
                $("#username").val('');
                $("#password").val('');
            }
        }
    );
}

  
$(function() {
    $('#sign-in-button').click(signIn);
});