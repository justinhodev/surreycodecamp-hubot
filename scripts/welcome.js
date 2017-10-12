'use strict';

class Welcome {
    constructor (hubot) {
        this.hubot = hubot;
        this.redis = null;

        this.hubot.enter(this.onJoin.bind(this));
    }

    initialize() {
        // an environment variable is used here as opposed to harcoding the string because it'll differ between
        // running on a local machine and after deployment to heroku. this follows the 12 factor principles for config:
        // https://12factor.net/config.
        if (process.env.REDIS_URL) {
          let parts = RedisUrl.parse(process.env.REDIS_URL);
          let opts = { password: parts.password || null, db: parts.database || null };
    
          // try to set the redis client. if there's an error, log it so that we can check out what's going on.
          try {
            this.redis = Redis.createClient(parts.port, parts.hostname, opts);
          } catch(err) {
            this.hubot.logger.error(err);
          }
        }

    // only do the time-based announcements if redis is connected. if it's not, then we can still get
    // the upcoming meetups through the command line. if we were to announce regardless of redis connection,
    // we'd get announcements every time hubot restarts (in the heroku world, that's on every deployment or
    // config change). not the end of the world, but a little annoying.
    if (this.redis) {
        this.redis.get(LAST_ANNOUNCED_KEY, (err, lastAnnounced) => {
          if (err) this.hubot.logger.error(err);
          this.lastAnnounced = parseInt(lastAnnounced || '0');
        });
      }
      if (NOTIFICATION_CHANNEL) setInterval(this.checkForAndAnnounceNewMeetups.bind(this), MEETUP_CHECK_INTERVAL);
    }

    // send message to channel when new user joins
    onJoin (resp) {
        // check if member is joining channel for the first time
        this.redis.sismember('welcome', resp.message.user.name, (err, isMember));
        if (isMember) {
            // log that user has been welcomed before
            this.hubot.logger.info(`Already welcomed ${resp.message.user.name}`);
            return;
        }

        // send message globally to channel
        resp.send(`Hello @${resp.message.user.name}, welcome to my test channel`);
        // private messages new user
        this.hubot.send({room: resp.message.user.id}, 'hey there pal');

        // store user name in redis after welcomed
        this.redis.sadd('welcome', resp.message.user.name);
    }
}

// exports hubot to be used
module.exports = (robot) => {
    let welcome = new Welcome (robot);
    welcome.initialize();
}