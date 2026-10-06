window.WEDDING_CONFIG = Object.freeze({
  names: 'Delilah & Juan Carlos',
  date: 'December 19, 2026',
  timezone: 'America/New_York',
  ceremonyStart: '2026-12-19T13:00:00-05:00',
  ceremonyEnd: '2026-12-19T14:00:00-05:00',
  celebrationStart: '2026-12-19T18:00:00-05:00',
  celebrationEnd: '2026-12-19T23:00:00-05:00',
  rsvpDeadline: 'November 6, 2026',
  musicPath: 'assets/love-story.m4a',
  apiPath: '/api/rsvps',
  maxGuests: 2,
  // Insert the couple's real photographs here. Keep paths relative to dist/.
  storyPhotos: ['assets/photos/the-day-we-met.jpg', '', ''],
  venues: {
    mass: {
      name: 'Saint Rose of Lima Catholic Church',
      address: '3880 Pleasant Hill Road, Kissimmee, FL 34746',
      time: '1:00 PM',
      mapsUrl: 'https://www.google.com/maps/place//data=!4m2!3m1!1s0x88dd9dae55555555:0xc8cd6480c83d3bac?entry=s&sa=X&ved=2ahUKEwj3vNjujoOXAxUJ4MkDHc7oAjMQ4kB6BAgVEAA&hl=en',
    },
    celebration: {
      name: 'Infinity Party Room',
      address: '2912 Pleasant Hill Road, Kissimmee, FL 34746',
      time: '6:00 PM',
      mapsUrl: 'https://maps.app.goo.gl/AQ5zuLSabpDiZpyC6?g_st=ac',
    },
  },
});
