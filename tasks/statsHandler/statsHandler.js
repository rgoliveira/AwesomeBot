const sqlite3 = require('sqlite3');

let db;
let config;
let client;
let lastUpdateTime = Date.now();
const hourlyMsgCount = {};

function handleMessage(message) {
  if (message.channel.type === 'text') {
    if (message.channel.id in hourlyMsgCount) {
      hourlyMsgCount[message.channel.id] += 1;
    } else {
      hourlyMsgCount[message.channel.id] = 1;
    }

    // Count overall messages per server as well
    if ('overall' in hourlyMsgCount) {
      hourlyMsgCount.overall += 1;
    } else {
      hourlyMsgCount.overall = 1;
    }

    db.run('INSERT INTO Leaderboard(Name) VALUES(?)', message.member.user.id);
  }
}

function initDatabase() {
  db.run('CREATE TABLE IF NOT EXISTS ChannelStats(' +
    'ID              INTEGER PRIMARY  KEY AUTOINCREMENT NOT NULL,' +
    'Name            TEXT  NOT NULL,' +
    'Date            TIMESTAMP   default (datetime(\'now\')),' +
    'MsgsPerHour   INTEGER   NOT NULL);');

  db.run('CREATE TABLE IF NOT EXISTS Members(' +
    'ID              INTEGER PRIMARY  KEY AUTOINCREMENT NOT NULL,' +
    'Date            TIMESTAMP   default (datetime(\'now\')),' +
    'MembersOnline   INTEGER NOT NULL,' +
    'Count           INTEGER   NOT NULL);');

  db.run('CREATE TABLE IF NOT EXISTS Leaderboard(' +
    'ID              INTEGER PRIMARY  KEY AUTOINCREMENT NOT NULL,' +
    'Date            TIMESTAMP   default (datetime(\'now\')),' +
    'Name            TEXT NOT NULL);');
}

function getMembersOnline() {
  return client.users.filter(user => user.presence.status !== 'offline').size;
}

// Ok, for some reason the setInterval is going off for me after a few calls if I set the interval to an hour
// Oddly enough, it doesn't seem to happen if I don't do any database calls
// I've lost all trust for node.js
function updateDatabase() {
  if (Date.now() - lastUpdateTime > (config.timeIntervalSec * 1000)) {
    lastUpdateTime = Date.now();

    // Insert hourly message count for each channel into ChannelStats table
    client.channels.forEach((item) => {
      if (item.type === 'text') {
        if (!(item.id in hourlyMsgCount)) {
          hourlyMsgCount[item.id] = 0;
        }
        db.run('INSERT INTO ChannelStats(Name,MsgsPerHour) VALUES(?,?);',
        [item.id, hourlyMsgCount[item.id]]);
        hourlyMsgCount[item.id] = 0;
      }
    }, this);

    // Update overall server stats
    // Sort of hacky, but eh
    if (!('overall' in hourlyMsgCount)) {
      hourlyMsgCount.overall = 0;
    }

    db.run('INSERT INTO ChannelStats(Name,MsgsPerHour) VALUES(?,?);',
      ['overall', hourlyMsgCount.overall]);
    hourlyMsgCount.overall = 0;

    db.run('INSERT INTO Members(MembersOnline,Count) VALUES(?,?);', getMembersOnline(), client.users.size);
  }
}

module.exports = {
  init: (bot) => {
    client = bot.client;
    config = bot.settings.stats;
    db = new sqlite3.Database('statistics.db');
    db.configure('busyTimeout', 2000); // 2 second busy timeout
    db.serialize();
    initDatabase();
    setInterval(updateDatabase, 1000); // Every second check to see if it's time to update
  },
  handleMessage: (message) => {
    handleMessage(message);
  },
};
