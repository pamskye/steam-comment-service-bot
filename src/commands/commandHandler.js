/*
 * File: commandHandler.js
 * Project: steam-comment-service-bot
 * Created Date: 01.04.2023 21:54:21
 * Author: 3urobeat
 *
 * Last Modified: 05.04.2023 20:09:52
 * Modified By: 3urobeat
 *
 * Copyright (c) 2023 3urobeat <https://github.com/HerrEurobeat>
 *
 * This program is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.
 * This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details.
 * You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>.
 */


const fs = require("fs");

const Controller = require("../controller/controller.js"); // eslint-disable-line


/**
 * Constructor - Initializes the commandHandler which allows you to integrate core commands into your plugin or add new commands from your plugin.
 * @param {Controller} controller Reference to the current controller object
 */
const CommandHandler = function(controller) {

    this.controller = controller;
    this.data       = controller.data;

    this.commands = []; // Array of objects, where each object represents a command

};


/**
 * Internal: Imports core commands on startup
 */
CommandHandler.prototype._importCoreCommands = function() {

    logger("info", "CommandHandler: Loading all core commands...", false, true, logger.animation("loading"));

    fs.readdir("./src/commands/core", (err, files) => {

        // Stop now on error or if nothing was found
        if (err)               return logger("error", "Error while reading core dir: " + err, true);
        if (files.length == 0) return logger("info", "No commands in ./core found!", false, true, logger.animation("loading"));

        // Iterate over all files in this dir
        files.forEach((e, i) => {
            let thisFile;

            // Try to load plugin
            try {
                // Load the plugin file
                thisFile = require(`./core/${e}`);

                // Push all exported commands in this file into the command list
                Object.values(thisFile).every(val => this.commands.push(val));

            } catch (err) {

                logger("error", `Error loading core command '${e}'! ${err.stack}`, true);
            }

            if (i + 1 == files.length) logger("info", `Loaded ${this.commands.length} core commands`, false, true, logger.animation("loading"));
        });
    });

};
};


module.exports = CommandHandler;