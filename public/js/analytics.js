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

  // Carpool-specific events
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

  // Location-related events
  locationAdded: function(locationName, locationType) {
    this.trackEvent('location-added', { locationName, locationType });
  },

  locationReused: function(locationId) {
    this.trackEvent('location-reused', { locationId });
  }
};