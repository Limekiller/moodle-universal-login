chrome.runtime.onMessage.addListener(
    async (formData, sender, onSuccess) => {
        console.log(formData)

        // Send initial post request to Moodle site with credentials
        // This might be enough to log us in on older sites
        const response = await fetch(`https://${formData.get('sitename')}/login/index.php`, {
            method: 'POST',
            body: formData,
            credentials: 'include'
        })
        const body = await response.text()
        let doc = new DOMParser().parseFromString(body, 'text/html')

        // Every Moodle site has a class on every page that is the domain with the dots replaced by dashes
        // We can check if that class exists to see if we're on a Moodle page
        const verificationKey = formData.get('sitename').replace(/\./g, "-")

        // If we're on a Moodle site,
        if (doc.querySelector(`.${verificationKey}`)) {
            // and there's no logintoken on the page
            if (!doc.querySelector('input[name="logintoken"]')) {
                // and there's no invalid login message, we must be logged in!
                if (!body.includes('Invalid login')) {
                    chrome.tabs.create({ url: `https://${formData.get('sitename')}`})
                    return true
                } else {
                    // oh no, there is an "invalid login" message, I guess it didn't work
                    return false
                }
            } else {
                // We're on a Moodle page, but it's a login page with a logintoken. Let's grab that and try re-POSTing the request
                const logintoken = doc.querySelector('input[name="logintoken"]').value
                formData.append('logintoken', logintoken)

                const response = await fetch(`https://${formData.get('sitename')}/login/index.php`, {
                    method: 'POST',
                    body: formData,
                    credentials: 'include'
                })
                const body = await response.text()
                doc = new DOMParser().parseFromString(body, 'text/html')

                // Check again: if we get back a Moodle page without an invalid login message, *we're in* (hacker voice)
                if (doc.querySelector(`.${verificationKey}`) && !body.includes('Invalid login')) {
                    chrome.tabs.create({ url: `https://${formData.get('sitename')}`})
                    return true
                }
            }
        }

        return false
    }
)