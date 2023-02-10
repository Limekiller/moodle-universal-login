chrome.runtime.onMessage.addListener((credentials, sender, sendResponse) => {
    // Clear all cookies on the domain first so we can log in anew
    chrome.cookies.getAll({domain: credentials['sitename']}, function(cookies) {
        for(let i = 0; i < cookies.length; i++) {
            chrome.cookies.remove({url: "https://" + cookies[i].domain  + cookies[i].path, name: cookies[i].name});
        }
    });

    processCredentials(credentials).then(response => sendResponse(response))
    return true
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
 * 
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
    if (doc.querySelector(`.${verificationKey}`) && !doc.body.innerHTML.includes('Invalid login')) {
        chrome.tabs.create({ url: `https://${urlencoded.get('sitename')}`})
        return true
    }

    return false
}

/**
 * 
 * @param {object} credentials: A dictionary of credentials to turn into a URLSearchParams object
 * @returns {boolean}: Were we able to login?
 */
const processCredentials = async credentials => {
    let urlencoded = new URLSearchParams()
    for (let item in credentials) {
        urlencoded.append(item, credentials[item])
    }

    // Every Moodle site has a class on every page that is the domain with the dots replaced by dashes
    // We can check if that class exists to see if we're on a Moodle page
    const verificationKey = urlencoded.get('sitename').replace(/\./g, "-")

    // Send initial post request to Moodle site with credentials
    // This might be enough to log us in on older sites
    let doc = await attemptLoginPOST(urlencoded)

    // If we're on a Moodle site,
    if (doc.querySelector(`.${verificationKey}`)) {
        // and there's no logintoken on the page
        if (!doc.querySelector('input[name="logintoken"]')) {
            // and there's no invalid login message, we must be logged in!
            if (!doc.body.innerHTML.includes('Invalid login')) {
                chrome.tabs.create({ url: `https://${urlencoded.get('sitename')}`})
                return true
            } else {
                // oh no, there is an "invalid login" message, I guess it didn't work
                return false
            }
        } else {
            // We're on a Moodle page, but it's a login page with a logintoken. Let's grab that and try re-POSTing the request
            let loggedIn = await processLoginToken(doc, urlencoded)
            if (loggedIn) {
                return true
            }
        }
    } else {
        // We didn't even get a Moodle page when POSTing to the login page. Let's try a GET request and go from there?
        let response = await fetch(`https://${urlencoded.get('sitename')}/login/index.php?saml=no&nosso=true&username=test`)
        let body = await response.text()
        let doc = new DOMParser().parseFromString(body, 'text/html')

        let loggedIn = await processLoginToken(doc, urlencoded)
        if (loggedIn) {
            return true
        }
    }

    // Ok, if we got here we probably didn't get in, but let's do one more GET request to see if we're logged in anyway
    // Try to access the /my page and see if we haven't been redirected
    response = await fetch(`https://${urlencoded.get('sitename')}/my`)
    body = await response.text()
    doc = new DOMParser().parseFromString(body, 'text/html')

    if (doc.querySelector('#page-my-index')) {
        chrome.tabs.create({ url: `https://${urlencoded.get('sitename')}`})
        return true
    }
    
    return false
}