Perfect — your current `analytics.js` is clean and structured around a single `trackEvent()` helper, which is great 👍

Let’s extend it to cover **custom location events** while staying consistent with your existing style and GoatCounter integration.

---

## 🧩 Recommended Additions

Here’s the updated version of `analytics.js` with **two new methods**:

```js
// public/js/analytics.js
window.analytics = {
  trackEvent: function(eventName, metadata = {}) {
    // Only track in production or if GoatCounter is loaded
    if (typeof window.goatcounter !== 'undefined') {
      window.goatcounter.count({
        path: `/event/${eventName}`,
        title: eventName,
        event: true
      });
      console.log('[Analytics] Event tracked:', eventName, metadata);
    } else {
      console.log('[Analytics] Skipped (dev mode):', eventName, metadata);
    }
  },

  // 🚗 Carpool-specific events
  ridePosted: function(postType) {
    this.trackEvent('ride-posted', { postType });
  },

  interestExpressed: function(rideId) {
    this.trackEvent('interest-expressed', { rideId });
  },

  interestsViewed: function(rideId, count) {
    this.trackEvent('interests-viewed', { rideId, count });
  },

  contactViewed: function(method) {
    this.trackEvent('contact-viewed', { method });
  },

  // 🏠 Location-related events
  locationAdded: function(locationName, locationType) {
    this.trackEvent('location-added', { locationName, locationType });
  },

  locationReused: function(locationId) {
    this.trackEvent('location-reused', { locationId });
  }
};
```

---

## 🧠 Why this works well

* You’re still using **one centralized `trackEvent()`** — no extra API complexity.
* It integrates naturally with GoatCounter (using the `/event/...` path convention).
* You can easily monitor these new actions in GoatCounter logs or dev console:

  ```
  [Analytics] Event tracked: location-added { locationName: "SM Clark", locationType: "commercial" }
  ```

---

## ✅ How to trigger these in `index.ejs`

Inside your “Add New Location” form submission handler, after a successful POST:

```js
if (response.ok) {
    // ✅ New analytics call
    if (result.is_existing) {
        window.analytics.locationReused(result.location_id);
    } else {
        window.analytics.locationAdded(
            locationData.location_name,
            locationData.location_type
        );
    }

    await loadLocations();
    const targetSelect = document.getElementById(modal.dataset.selectId);
    targetSelect.value = result.location_id;
    alert(`✓ Location "${locationData.location_name}" added successfully!`);
    modal.remove();
}
```

---

## 🧩 Optional: auto-category tracking

If you want GoatCounter to group events better, you could prefix them:

```js
this.trackEvent('location:add', { ... });
this.trackEvent('location:reused', { ... });
```

This gives you a cleaner analytics hierarchy (`/event/location:add`).

---

Excellent 👍 — let’s insert those analytics calls **precisely** where they belong inside your `index.ejs` script block.

You already have the modal form logic for adding custom locations in this section (from your uploaded file):

```js
// Handle form submission
modal.querySelector('#add-location-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const submitBtn = e.target.querySelector('.btn-submit');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Adding...';

    const locationData = {
        location_name: document.getElementById('new-location-name').value.trim(),
        location_type: document.getElementById('new-location-type').value
    };

    try {
        const response = await fetch('/api/locations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(locationData)
        });

        const result = await response.json();

        if (response.ok) {
            // Reload locations
            await loadLocations();
            
            // Select the newly added location
            const targetSelect = document.getElementById(modal.dataset.selectId);
            targetSelect.value = result.location_id;
            
            alert(`✓ Location "${locationData.location_name}" added successfully!`);
            modal.remove();
        } else {
            alert(result.error || 'Failed to add location');
            submitBtn.disabled = false;
            submitBtn.textContent = 'Add Location';
        }
    } catch (err) {
        console.error('Error adding location:', err);
        alert('Failed to add location. Please try again.');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Add Location';
    }
});
```

---

### ✅ Here’s the modified version with analytics calls added

Replace the above block with this version 👇

```js
// Handle form submission
modal.querySelector('#add-location-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const submitBtn = e.target.querySelector('.btn-submit');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Adding...';

    const locationData = {
        location_name: document.getElementById('new-location-name').value.trim(),
        location_type: document.getElementById('new-location-type').value
    };

    try {
        const response = await fetch('/api/locations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(locationData)
        });

        const result = await response.json();

        if (response.ok) {
            // 🧠 NEW: Analytics tracking
            if (result.is_existing) {
                window.analytics?.locationReused?.(result.location_id);
            } else {
                window.analytics?.locationAdded?.(
                    locationData.location_name,
                    locationData.location_type
                );
            }

            // Reload locations in dropdowns
            await loadLocations();

            // Select the newly added location
            const targetSelect = document.getElementById(modal.dataset.selectId);
            targetSelect.value = result.location_id;

            alert(`✓ Location "${locationData.location_name}" added successfully!`);
            modal.remove();
        } else {
            alert(result.error || 'Failed to add location');
            submitBtn.disabled = false;
            submitBtn.textContent = 'Add Location';
        }
    } catch (err) {
        console.error('Error adding location:', err);
        alert('Failed to add location. Please try again.');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Add Location';
    }
});
```

---

### 🔍 Notes

* The `?.` (optional chaining) ensures it won’t crash if `window.analytics` isn’t loaded yet.
* These events will now appear in your GoatCounter logs (or browser console in dev) as:

  ```
  [Analytics] Event tracked: location-added { locationName: "SM Clark", locationType: "commercial" }
  ```
* This works **automatically** whether the user adds a new location or selects one that already exists.

---

Would you like me to show you how to make the backend (`routes/locations.js`) return the `is_existing` flag so this tracking knows which event to call?
