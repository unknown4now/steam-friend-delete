/**
 * @author mason
 */
const banner = `
 █     █░▓█████  ██▓     ▄████▄   ▒█████   ███▄ ▄███▓▓█████ 
▓█░ █ ░█░▓█   ▀ ▓██▒    ▒██▀ ▀█  ▒██▒  ██▒▓██▒▀█▀ ██▒▓█   ▀ 
▒█░ █ ░█ ▒███   ▒██░    ▒▓█    ▄ ▒██░  ██▒▓██    ▓██░▒███   
░█░ █ ░█ ▒▓█  ▄ ▒██░    ▒▓▓▄ ▄██▒▒██   ██░▒██    ▒██ ▒▓█  ▄ 
░░██▒██▓ ░▒████▒░██████▒▒ ▓███▀ ░░ ████▓▒░▒██▒   ░██▒░▒████▒
░ ▓░▒ ▒  ░░ ▒░ ░░ ▒░▓  ░░ ░▒ ▒  ░░ ▒░▒░▒░ ░ ▒░   ░  ░░░ ▒░ ░
  ▒ ░ ░   ░ ░  ░░ ░ ▒  ░  ░  ▒     ░ ▒ ▒░ ░  ░      ░ ░ ░  ░
  ░   ░     ░     ░ ░   ░        ░ ░ ░ ▒  ░      ░      ░   
    ░       ░  ░    ░  ░░ ░          ░ ░         ░      ░  ░
                        ░                                   
`;

console.log(banner);
const SteamUser = require('steam-user');
const readline = require('readline');
const request = require('request');
const fs = require('fs');

//steam web API key
const apiKey = "";

//create a readline interface for user interaction
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const accounts = [];

fs.readFileSync("accounts.txt").toString().split(/\r\n|\r|\n/).forEach((line) => {
    const a = line.split(":");
    if (a.length !== 2) {
        throw new Error("Invalid accounts file format.");
    }

    accounts.push({
        "login": a[0],
        "password": a[1]
    });
});


console.log("%d Account(s) successfully loaded.\n", accounts.length);

//function to delete friends and log off for each account
const deleteFriendsAndLogoff = async () => {
	
    //loop through each account and process them one by one
    for (const account of accounts) {
        const botLogin = account.login;
        const botPassword = account.password;

        console.log(`Logging in to account ${botLogin}`);

        //create a new instance of the SteamUser class for each bot account
        const bot = new SteamUser();

        let isLoggedOnHandled = false; // flag to track if the loggedOn event has been handled

        await new Promise((resolve) => {
            
            bot.on('loggedOn', async () => {
                if (isLoggedOnHandled) {
                    //If the loggedOn event is already handled (possibly due to reconnect) return to avoid duplicate processing
                    return;
                }

                isLoggedOnHandled = true; // set the flag to true to indicate that the event is handled

                console.log("Logged on as", bot.steamID.getSteamID64());

                //retrieve friend list using Steam Web API
                getFriendList(bot.steamID.getSteamID64(), apiKey, (err, friendSteamIDs) => {
                    if (err) {
                        console.log(`Error getting friend list for ${bot.steamID.getSteamID64()}:`, err.message);
                        bot.logOff();
                        resolve(); // resolve the promise to move to the next account
                        return;
                    }

                    console.log(`Found ${friendSteamIDs.length} friend(s) for ${bot.steamID.getSteamID64()}`);

                    let friendsRemoved = 0;

                    //remove each friend with a delay
                    const removeNextFriend = (index) => {
                        if (index >= friendSteamIDs.length) {
                            bot.logOff();
                            resolve();
                            return;
                        }

                        const steamID = friendSteamIDs[index];
                        console.log(`Removing friend ${steamID} from ${bot.steamID.getSteamID64()}`);
                        bot.removeFriend(steamID, (err) => {
                            if (err) {
                                console.log(`Error removing friend ${steamID} from ${bot.steamID.getSteamID64()}:`, err.message);
                            } else {
                                console.log(`Friend ${steamID} successfully removed from ${bot.steamID.getSteamID64()}`);
                            }
                            friendsRemoved++;

                            //remove the next friend after a delay
                            setTimeout(() => {
                                removeNextFriend(index + 1);
                            }, 1000); //you can adjust delay for each friend

                            if (friendsRemoved === friendSteamIDs.length) {
                                bot.logOff();
                                resolve();
                            }
                        });
                    };

                    
                    removeNextFriend(0);
                });
            });

            
            bot.on('disconnected', () => {
                console.log(`Switching to the next account...`);
                resolve();
            });

            bot.on('error', (err) => {
                console.error(`Error logging in to account ${botLogin}:`, err.message);
                bot.logOff();
                resolve(); //resolve the promise to move to the next account
            });


            bot.logOn({
                accountName: botLogin,
                password: botPassword
            });
        });

        //adding a delay before moving to the next account, so you can change this if you want, but this should be good!
        await new Promise(resolve => setTimeout(resolve, 2000));
    }
};

//function to get the friend list of a Steam account using Steam Web API, obviously you will need a apikey for this!
const getFriendList = (steamID, apiKey, callback) => {
    const url = `http://api.steampowered.com/ISteamUser/GetFriendList/v0001/?key=${apiKey}&steamid=${steamID}&relationship=friend`;
    request(url, (error, response, body) => {
        if (!error && response.statusCode === 200) {
            const data = JSON.parse(body);
            if (data && data.friendslist && data.friendslist.friends) {
                const friendSteamIDs = data.friendslist.friends.map(friend => friend.steamid);
                callback(null, friendSteamIDs);
            } else {
                callback(new Error("Error getting friend list"));
            }
        } else {
            callback(new Error("Error retrieving friend list from Steam Web API"));
        }
    });
};

//start deleting friends from all accounts
deleteFriendsAndLogoff()
  .then(() => {
    console.log("Script completed. All friends removed from all accounts.");
    rl.close();
  })
  .catch((err) => {
    console.error("Error occurred while running the script:", err);
    rl.close();
    process.exit(1);
  });