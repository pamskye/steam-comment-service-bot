/*
 * File: dataCheck.js
 * Project: steam-comment-service-bot
 * Created Date: 09.07.2021 16:26:00
 * Author: 3urobeat
 *
 * Last Modified: 23.03.2023 21:41:30
 * Modified By: 3urobeat
 *
 * Copyright (c) 2023 3urobeat <https://github.com/HerrEurobeat>
 *
 * This program is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.
 * This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details.
 * You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>.
 */


const fs              = require("fs");
const os              = require("os");
const steamIdResolver = require("steamid-resolver");

const DataManager = require("./dataManagement.js");


/**
 * Checks currently loaded data for validity and logs some recommendations for a few settings.
 * @returns {Promise} Resolves promise when all checks have finished. If promise is rejected you should terminate the application or reset the changes. Reject is called with a String specifying the failed check.
 */
DataManager.prototype.checkData = function() {

    return new Promise((resolve, reject) => {

        logger("info", "Running datachecks...", false, true, logger.animation("loading"));

        // Refresh cache of ownerids. getOwnerID() will also print an error message if user provided invalid ids
        require("../controller/helpers/getOwnerID.js").getOwnerID(null, (ids) => {
            this.cachefile["ownerid"] = ids; // Refresh cache

            // Filter all invalid entries which got replaced with null
            if (ids.filter(e => e != null).length == 0) {
                logger("error", "Error: You did not set at least one valid ownerid in config.json! Aborting!");
                return reject("no-ownerid-found");
            }
        });


        // Check config for default value leftovers and remove myself from config on different computer
        if ((process.env.LOGNAME !== "tomg") || (os.hostname() !== "Toms-PC" && os.hostname() !== "Toms-Server" && os.hostname() !== "Toms-Thinkpad")) {
            let write = false;

            if (this.config.owner.includes(extdata.mestr))         { this.config.owner = ""; write = true; }
            if (this.config.ownerid.includes("76561198260031749")) { this.config.ownerid.splice(this.config.ownerid.indexOf("76561198260031749"), 1); write = true; }
            if (this.config.ownerid.includes("3urobeat"))          { this.config.ownerid.splice(this.config.ownerid.indexOf("3urobeat"), 1); write = true; }

            // Moin Tom, solltest du in der Zukunft noch einmal auf dieses Projekt zurückschauen, dann hoffe ich dass du etwas sinnvolles mit deinem Leben gemacht hast. (08.06.2020)
            // Dieses Projekt war das erste Projekt welches wirklich ein wenig Aufmerksamkeit bekommen hat. (1,5k Aufrufe in den letzten 14 Tagen auf GitHub, 1,3k Aufrufe auf mein YouTube Tutorial, 15k Aufrufe auf ein Tutorial zu meinem Bot von jemand fremden)
            // Das Projekt hat schon bis jetzt viel Zeit in Anspruch genommen, die ersten Klausuren nach der Corona Pandemie haben bisschen darunter gelitten. All der Code ist bis auf einzelne, markierte Schnipsel selbst geschrieben. Node Version zum aktuellen Zeitpunkt: v12.16.3
            // Kleines Update: Das Repo hat letztens (am 17.03.2023) die 100 Sterne geknackt!

            if (write) {
                // Get arrays on one line
                let stringifiedconfig = JSON.stringify(this.config, function(k, v) { // Credit: https://stackoverflow.com/a/46217335/12934162
                    if (v instanceof Array) return JSON.stringify(v);
                    return v;
                }, 4)
                    .replace(/"\[/g, "[")
                    .replace(/\]"/g, "]")
                    .replace(/\\"/g, '"')
                    .replace(/""/g, '""');

                fs.writeFile("./config.json", stringifiedconfig, (err) => {
                    if (err) logger("error", "Error cleaning config.json: " + err, true);
                });
            }
        }


        // Check config values:
        this.config.maxComments      = Math.round(this.config.maxComments); // Round maxComments number every time to avoid user being able to set weird numbers (who can comment 4.8 times? right - no one)
        this.config.maxOwnerComments = Math.round(this.config.maxOwnerComments);

        let maxCommentsOverall = this.config.maxOwnerComments; // Define what the absolute maximum is which the bot is allowed to process. This should make checks shorter
        if (this.config.maxComments > this.config.maxOwnerComments) maxCommentsOverall = this.config.maxComments;

        if (this.logininfo.bot0 == undefined) { // Check real quick if logininfo is empty
            logger("error", `${logger.colors.fgred}Your accounts.txt or logininfo.json file (whichever you are using) doesn't seem to contain any valid login credentials! Aborting...`, true);
            return reject("no-logininfo-found");
        }
        if (this.config.maxOwnerComments < 1) {
            logger("info", `${logger.colors.fgred}Your maxOwnerComments value in config.json can't be smaller than 1! Automatically setting it to 1...`, true);
            this.config.maxOwnerComments = 1;
        }
        if (this.config.commentdelay <= 500) {
            logger("warn", `${logger.colors.fgred}Your commentdelay is set to a way too low value!\n        Using a commentdelay of 500ms or less will result in an instant cooldown from Steam and therefore a failed comment request.\n       Automatically setting it to the default value of 15 seconds...`, true);
            this.config.commentdelay = 15000;
        }
        if (this.config.commentdelay / (maxCommentsOverall / 2) < 1250) {
            logger("warn", `${logger.colors.fgred}You have raised maxComments or maxOwnerComments but I would recommend to raise the commentdelay further. Not increasing the commentdelay further raises the probability to get cooldown errors from Steam.`, true);
        }
        if (this.config.commentdelay * maxCommentsOverall > 2147483647) { // Check for 32-bit integer limit for commentcmd timeout
            logger("error", `${logger.colors.fgred}Your maxComments and/or maxOwnerComments and/or commentdelay value in the config are too high.\n        Please lower these values so that 'commentdelay * maxComments' is not bigger than 2147483647 (32-bit integer limit).\n\nThis will otherwise cause an error when trying to comment. Aborting...\n`, true);
            return reject("commentdelay-times-maxcomments-exceeds-32bit-limit");
        }
        if (this.config.randomizeAccounts && Object.keys(this.logininfo).length <= 5 && maxCommentsOverall > Object.keys(this.logininfo).length * 2) {
            logger("warn", `${logger.colors.fgred}I wouldn't recommend using randomizeAccounts with 5 or less accounts when each account can/has to comment multiple times. The chance of an account getting a cooldown is higher.\n        Please make sure your commentdelay is set adequately to reduce the chance of this happening.`, true);
        }
        if (this.advancedconfig.loginDelay < 500) { // Don't allow a logindelay below 500ms
            logger("error", `${logger.colors.fgred}I won't allow a logindelay below 500ms as this will probably get you blocked by Steam nearly instantly. I recommend setting it to 2500.\n        If you are using one proxy per account you might try setting it to 500 (on your own risk!). Aborting...`, true);
            return reject("logindelay-below-500ms");
        }
        if (this.advancedconfig.lastQuotesSize >= this.quotes) { // Force clear lastQuotes array if we have less or equal amount of quotes to choose from than lastQuotesSize to avoid infinite loop
            logger("warn", "lastQuoteSize in 'advancedconfig.json' is greater or equal than the amount of quotes found in 'quotes.txt'. I'm therefore unable to filter recently used quotes when choosing a new one!", true);
        }


        global.checkm8="b754jfJNgZWGnzogvl<rsHGTR4e368essegs9<";

        // Check if owner link is correct
        if (!this.config.owner.includes("steamcommunity.com")) {
            logger("warn", "You haven't set a correct owner link to your profile in the config!\n       Please add this to refer to yourself as the owner and operator of this bot.", true);

        } else {

            try {
                // Check if user provided /profiles/steamID64 link or /id/customURL link
                if (this.config.owner.includes("/profiles/")) {
                    steamIdResolver.steamID64ToFullInfo(this.config.owner, (err, ownerResult) => {
                        if (err == "The specified profile could not be found.") { // If the profile couldn't be found display specific message
                            return logger("warn", "You haven't set a correct owner link to your profile in the config!\n       Please add this to refer to yourself as the owner and operator of this bot.\n       Error: " + err, true);
                        } else {
                            if (err) return logger("error", "Error checking if owner is valid: " + err); // If a different error then display a generic message with the error
                        }

                        this.cachefile["ownerlinkid"] = ownerResult.steamID64[0]; // Refresh ownerlinkid in cache.json

                        logger("debug", `DataManager checkData(): Successfully checked owner link. customURL: ${ownerResult.customURL[0]}`);
                    });

                } else {

                    steamIdResolver.customUrlTosteamID64(this.config.owner, (err, ownerResult) => {
                        if (err == "The specified profile could not be found.") { // If the profile couldn't be found display specific message
                            return logger("warn", "You haven't set a correct owner link to your profile in the config!\n       Please add this to refer to yourself as the owner and operator of this bot.\n       Error: " + err, true);
                        } else {
                            if (err) return logger("error", "Error checking if owner is valid: " + err); // If a different error then display a generic message with the error
                        }

                        this.cachefile["ownerlinkid"] = ownerResult; // Refresh ownerlinkid in cache.json

                        logger("debug", `DataManager checkData(): Successfully checked owner link. steamID64: ${ownerResult}`);
                    });
                }

            } catch (err) {
                if (err) return logger("error", "error getting owner profile xml info: " + err, true);
            }
        }


        // Resolve promise if this point was reached
        logger("debug", "DataManager checkData(): All checks ran successfully! Resolving promise...");
        resolve();

    });

};