document.querySelector(".loginButton").addEventListener('click', e => {

    let formData = new FormData()
    const credentialArray = ['sitename', 'username', 'password']

    for (credentialType of credentialArray) {
        formData.append(credentialType, document.querySelector(`#${credentialType}`).value)
    }

    chrome.runtime.sendMessage(formData, data => {
        if (!data) {
            chrome.notifications.create({
                type: "basic",
                title: "Login failed!",
                message: "It doesn't look like those credentials worked for that site, sorry!"
            });
        }
    })
})