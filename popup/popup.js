document.querySelector("#sitename").addEventListener('change', e => {
    e.target.value = e.target.value.replace('http://', '').replace('https://', '').split('/')[0]
})

document.querySelector("#password").addEventListener('keyup', e => {
    if (e.key == "Enter") {
        document.querySelector('.loginButton').click()
    }
})

document.querySelector(".loginButton").addEventListener('click', e => {

    document.querySelector('body').classList.add('loading')
    let credentials = {}
    const credentialArray = ['sitename', 'username', 'password']
    for (let credentialType of credentialArray) {
        credentials[credentialType] = document.querySelector(`#${credentialType}`).value
    }

    chrome.runtime.sendMessage(credentials, data => {
        document.querySelector('body').classList.remove('loading')
        if (!data) {
            chrome.notifications.create({
                type: "basic",
                title: "Login failed!",
                message: "Failed to authenticate. Either the credentials were wrong or this site isn't working with the extension at this time.",
                iconUrl: "/icons/icon32.png"
            });
        }
    })
})