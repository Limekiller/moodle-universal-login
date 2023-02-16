chrome.runtime.onConnect.addListener(port => {
    port.onMessage.addListener(data => {
        // Remove all existing cookies before attempting to log in, so we can log in anew
        chrome.cookies.getAll({ domain: data.credentials['sitename'] }, function (cookies) {
            for (let i = 0; i < cookies.length; i++) {
                chrome.cookies.remove({ url: "https://" + cookies[i].domain + cookies[i].path, name: cookies[i].name });
            }
        });

        processCredentials(data.credentials, port).then(response => port.postMessage({ type: 'reportCompletion', data: response }))
        return true
    })
})

/**
 * Make a POST request to a site's login endpoint
 * @param {URLSearchParams} urlencoded: The request body params
 * @returns {DOMParser}: The parsed DOM object from the fetch response
 */
const attemptLoginPOST = async urlencoded => {
    let response = await fetch(`https://${urlencoded.get('sitename')}/login/index.php`, {
        method: 'POST',
        body: urlencoded,
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        }
    })
    let body = await response.text()
    let doc = new DOMParser().parseFromString(body, 'text/html')

    return doc
}

/**
 * Extract a logintoken from a document and reattempt login
 * @param {DOMParser} doc: The DOMParser object to fetch the logintoken from
 * @param {URLSearchParams} urlencoded: The request body params
 * @returns {boolean}: Are we logged in?
 */
const processLoginToken = async (doc, urlencoded) => {
    const verificationKey = urlencoded.get('sitename').replace(/\./g, "-")

    let logintoken
    if (doc.querySelector('input[name="logintoken"]')) {
        logintoken = doc.querySelector('input[name="logintoken"]').value
    } else {
        return false
    }
    urlencoded.append('logintoken', logintoken)

    doc = await attemptLoginPOST(urlencoded)

    // Check again: if we get back a Moodle page without an invalid login message, *we're in* (hacker voice)
    if (doc.querySelector(`.${verificationKey}`)
      && !doc.body.innerHTML.includes('Invalid login')
      && !doc.body.innerHTML.includes('You are not logged in')) {
        chrome.tabs.create({ url: `https://${urlencoded.get('sitename')}` })
        return true
    }

    return false
}

/**
 * Main login function
 * @param {object} credentials: A dictionary of credentials to turn into a URLSearchParams object
 * @returns {boolean}: Were we able to login?
 */
const processCredentials = async (credentials, port = null) => {
    let urlencoded = new URLSearchParams()
    for (let item in credentials) {
        urlencoded.append(item, credentials[item])
    }

    // Every Moodle site has a class on every page that is the domain with the dots replaced by dashes
    // We can check if that class exists to see if we're on a Moodle page
    const verificationKey = urlencoded.get('sitename').replace(/\./g, "-")

    // Send initial post request to Moodle site with credentials
    // This might be enough to log us in on older sites
    port.postMessage({ type: 'reportProgress', data: 10 })
    let doc = await attemptLoginPOST(urlencoded)
    port.postMessage({ type: 'reportProgress', data: 25 })

    // If we're on a Moodle site,
    if (doc.querySelector(`.${verificationKey}`)) {
        // and there's no logintoken on the page
        if (!doc.querySelector('input[name="logintoken"]')) {
            port.postMessage({ type: 'reportProgress', data: 100 })
            // and there's no invalid login message, we must be logged in!
            if (!doc.body.innerHTML.includes('Invalid login')) {
                chrome.tabs.create({ url: `https://${urlencoded.get('sitename')}` })
                return true
            } else {
                // oh no, there is an "invalid login" message, I guess it didn't work
                return false
            }
        } else {
            // We're on a Moodle page, but it's a login page with a logintoken. Let's grab that and try re-POSTing the request
            let loggedIn = await processLoginToken(doc, urlencoded)
            if (loggedIn) {
                port.postMessage({ type: 'reportProgress', data: 100 })
                return true
            }

            port.postMessage({ type: 'reportProgress', data: 75 })
        }
    } else {
        // We didn't even get a Moodle page when POSTing to the login page. Let's try a GET request and go from there?
        let response = await fetch(`https://${urlencoded.get('sitename')}/login/index.php?saml=no&nosso=true&username=test`)
        let body = await response.text()
        let doc = new DOMParser().parseFromString(body, 'text/html')

        port.postMessage({ type: 'reportProgress', data: 33 })
        let loggedIn = await processLoginToken(doc, urlencoded)
        port.postMessage({ type: 'reportProgress', data: 75 })

        if (loggedIn) {
            port.postMessage({ type: 'reportProgress', data: 100 })
            return true
        }
    }

    // Ok, if we got here we probably didn't get in, but let's do one more GET request to see if we're logged in anyway
    // Try to access the /my page and see if we haven't been redirected
    response = await fetch(`https://${urlencoded.get('sitename')}/my`)
    body = await response.text()
    doc = new DOMParser().parseFromString(body, 'text/html')

    port.postMessage({ type: 'reportProgress', data: 100 })

    if (doc.querySelector('#page-my-index')) {
        chrome.tabs.create({ url: `https://${urlencoded.get('sitename')}` })
        return true
    }

    return false
}