document.querySelector("#sitename").addEventListener('change', e => { e.target.value = e.target.value.replace('http://', '').replace('https://', '').split('/')[0]
})

document.querySelector("#password").addEventListener('keyup', e => {
    if (e.key == "Enter") {
        document.querySelector('.loginButton').click()
    }
})

document.querySelector(".currURL").addEventListener('click', e => {
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
        const tab = tabs[0];
        const url = new URL(tab.url)
        const domain = url.hostname
        document.querySelector("#sitename").value = domain
    })
})

document.querySelector(".loginButton").addEventListener('click', e => {

    document.querySelector('body').classList.add('loading')
    document.querySelector('.loginButton').innerHTML = 'Loading...'
    document.querySelector('#password').blur()

    let credentials = {}
    const credentialArray = ['sitename', 'username', 'password']
    for (let credentialType of credentialArray) {
        credentials[credentialType] = document.querySelector(`#${credentialType}`).value
    }

    // This is used to help animate the background loading indicator of the submit button
    // We get the current background position value if one exists -- otherwise, it starts at "100"
    const startingBgPos = document.querySelector('.loginButton').style.backgroundPosition.split('%')[0] ?
        document.querySelector('.loginButton').style.backgroundPosition.split('%')[0] :
        '100'

    const port = chrome.runtime.connect({ name: "loginflow" })
    port.postMessage({ credentials: credentials })
    port.onMessage.addListener(msg => {
        if (msg.type == 'reportCompletion') {

            document.querySelector('body').classList.remove('loading')
            document.querySelector('.loginButton').innerHTML = 'Log In'
            setTimeout(() => {
                const currBgPos = document.querySelector('.loginButton').style.backgroundPosition
                document.querySelector('.loginButton').style.backgroundPosition = `${currBgPos.split('%')[0] - 100}%`
            }, 200)

            if (!msg.data) {
                chrome.notifications.create({
                    type: "basic",
                    title: "Login failed!",
                    message: "Failed to authenticate. Either the credentials were wrong or this site isn't working with the extension at this time.",
                    iconUrl: "/icons/icon32.png"
                })
            }

        } else if (msg.type == 'reportProgress') {
            document.querySelector('.loginButton').style.backgroundPosition = `${startingBgPos - msg.data}%`
        }
    })
})
