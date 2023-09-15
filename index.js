// index.js

// Import the Commander library
const { program } = require('commander');
const inquirer = require('inquirer');
const { spawn, exec } = require('child_process');
const fs = require('fs');
const path = require('path');

// Define the program version and description
program
    .version('1.0.0')
    .description('A CLI tool for managing MongoDB instances');


// Define a sample command
program
    .command('create')
    .description('Create a new MongoDB instance')
    .action(() => {
        inquirer
            .prompt([
                {
                    type: 'input',
                    name: 'instanceName',
                    message: 'Enter a name for the new instance:',
                },
                {
                    type: 'input',
                    name: 'dataDirectory',
                    message: 'Enter the data directory path:',
                    default: '/var/mongodb/data', // Default data directory path
                },
                {
                    type: 'input',
                    name: 'port',
                    message: 'Enter the port for the new instance:',
                    default: 27017, // Default port
                },
            ])
            .then((answers) => {
                const { instanceName, dataDirectory, port } = answers;
                console.log(`Creating MongoDB instance: ${instanceName}`);
                console.log(`Data directory: ${dataDirectory}/${instanceName}`);
                console.log(`Port: ${port}`);

                // Create the data directory if it doesn't exist
                const instanceDataDir = path.join(dataDirectory, instanceName);
                if (!fs.existsSync(instanceDataDir)) {
                    fs.mkdirSync(instanceDataDir, { recursive: true });
                }

                // Store the MongoDB instance information in a JSON file
                const instanceInfo = {
                    name: instanceName,
                    dataDirectory: instanceDataDir,
                    port: Number(port),
                    status: 'stopped', // Set the initial status to stopped
                };

                const configFile = 'mongodb-instances.json';
                const existingData = fs.existsSync(configFile)
                    ? JSON.parse(fs.readFileSync(configFile, 'utf8'))
                    : [];

                // Implement the instance creation logic here
                // Spawn a child process to run MongoDB as a background service
                const mongodProcess = spawn('mongod', ['--port', port.toString(), '--dbpath', instanceDataDir]);

                // Handle child process events (e.g., error, exit)
                mongodProcess.on('error', (error) => {
                    console.error(`Error creating instance: ${error.message}`);
                    process.exit(0);
                });

                mongodProcess.stdout.on('data', (data) => {
                    // update the status of the instance
                    instanceInfo.status = 'running';
                    existingData.push(instanceInfo);
                    fs.writeFileSync(configFile, JSON.stringify(existingData, null, 2));
                    process.exit(0);
                    console.log('Instance created successfully');
                } );
            });
    });

const stopInstance = (instanceId) => {
    const configFile = 'mongodb-instances.json';
    if (fs.existsSync(configFile)) {
        const instances = JSON.parse(fs.readFileSync(configFile, 'utf8'));
        if (instanceId >= 0 && instanceId < instances.length) {
            const instance = instances[instanceId];
            console.log(`Stopping MongoDB instance ${instance.name}`);

            // Get the PID of the MongoDB instance
            exec(`pgrep -f "mongod --port ${instance.port}"`, (error, stdout, stderr) => {
                if (error) {
                    console.error(`Error finding PID: ${error}`);
                } else {
                    const pid = parseInt(stdout);
                    if (!isNaN(pid)) {
                        // Send a termination signal to the process
                        exec(`kill ${pid}`, (killError) => {
                            if (killError) {
                                console.error(`Error stopping instance: ${killError}`);
                                instance.status = 'stopped';
                                fs.writeFileSync(configFile, JSON.stringify(instances, null, 2));
                            } else {
                                console.log(`Instance ${instance.name} has been stopped.`);
                                // Update the status to "stopped"
                                instance.status = 'stopped';
                                fs.writeFileSync(configFile, JSON.stringify(instances, null, 2));
                            }
                        });
                    } else {
                        console.error(`Failed to find a valid PID for instance ${instance.name}`);
                    }
                }
            });
        } else {
            console.error('Invalid instance ID. Use the "list" command to see available instances.');
        }
    } else {
        console.log('No MongoDB instances found.');
    }
}

program
    .command('stop <instanceId>')
    .description('Stop a MongoDB instance')
    .action((instanceId) => {
        stopInstance(instanceId);
    });

program
    .command('list')
    .description('List MongoDB instances')
    .action(() => {
        const configFile = 'mongodb-instances.json';
        if (fs.existsSync(configFile)) {
            const instances = JSON.parse(fs.readFileSync(configFile, 'utf8'));
            console.log('List of MongoDB instances:');
            // Print the list of instances using console.table()

            console.table(instances);

            // instances.forEach((instance, index) => {
            //     console.log(`Instance ${index + 1}:`);
            //     console.log(`  ID: ${index}`);
            //     console.log(`  Name: ${instance.name}`);
            //     console.log(`  Data Directory: ${instance.dataDirectory}`);
            //     console.log(`  Port: ${instance.port}`);
            //     console.log(`  Status: ${instance.status}`); // Add this line
            // });
        } else {
            console.log('No MongoDB instances found.');
        }
    });

const startInstance = (instanceId) => {
    const configFile = 'mongodb-instances.json';
    if (fs.existsSync(configFile)) {
        const instances = JSON.parse(fs.readFileSync(configFile, 'utf8'));
        if (instanceId >= 0 && instanceId < instances.length) {
            const instance = instances[instanceId];
            console.log(`Starting MongoDB instance ${instance.name}`);

            // Check if the instance is currently running
            if (instance.status === 'running') {
                console.log('Instance is already running.');
            } else {
                // Spawn a child process to run MongoDB as a background service
                const mongodProcess = spawn('mongod', ['--port', instance.port.toString(), '--dbpath', instance.dataDirectory]);

                // Handle child process events (e.g., error, exit)
                mongodProcess.on('error', (error) => {
                    console.error(`Error starting instance: ${error.message}`);
                });

                mongodProcess.stdout.on('data', (data) => {
                    console.log('Instance started successfully');
                    // Update the status to "running"
                    instance.status = 'running';
                    fs.writeFileSync(configFile, JSON.stringify(instances, null, 2));
                    process.exit(0);
                });
            }
        } else {
            console.error('Invalid instance ID. Use the "list" command to see available instances.');
        }
    } else {
        console.log('No MongoDB instances found.');
    }
}

program
    .command('restart <instanceId>')
    .description('Restart a MongoDB instance')
    .action((instanceId) => {
        const configFile = 'mongodb-instances.json';
        if (fs.existsSync(configFile)) {
            const instances = JSON.parse(fs.readFileSync(configFile, 'utf8'));
            if (instanceId >= 0 && instanceId < instances.length) {
                const instance = instances[instanceId];
                console.log(`Restarting MongoDB instance ${instance.name}`);

                // Check if the instance is currently running
                if (instance.status === 'running') {
                    // Stop the instance (you can reuse the stop logic from the previous step)
                    stopInstance(instanceId)

                    // Wait for a moment (e.g., a few seconds) before starting it again
                    setTimeout(() => {
                        // Start the instance (you can reuse the start logic from the previous steps)
                        startInstance(instanceId)

                        console.log(`Instance ${instance.name} has been restarted.`);
                    }, 5000); // Adjust the delay as needed
                } else {
                    // If the instance is not running, simply start it
                    // Start the instance (you can reuse the start logic from the previous steps)
                    startInstance(instanceId)
                    console.log(`Instance ${instance.name} has been started.`);
                }
            } else {
                console.error('Invalid instance ID. Use the "list" command to see available instances.');
            }
        } else {
            console.log('No MongoDB instances found.');
        }
    });


program
    .command('restart <instanceId>')
    .description('Restart a MongoDB instance')
    .action((instanceId) => {
        startInstance(instanceId);
    });

program
    .command('delete <instanceId>')
    .description('Delete a MongoDB instance')
    .action((instanceId) => {
        const configFile = 'mongodb-instances.json';
        if (fs.existsSync(configFile)) {
            const instances = JSON.parse(fs.readFileSync(configFile, 'utf8'));
            if (instanceId >= 0 && instanceId < instances.length) {
                const instance = instances[instanceId];
                console.log(`Deleting MongoDB instance ${instance.name}`);

                // Check if the instance is currently running
                if (instance.status === 'running') {
                    // Stop the instance (you can reuse the stop logic from the previous steps)
                    stopInstance(instanceId)

                    // Wait for a moment (e.g., a few seconds) before removing it
                    setTimeout(() => {
                        // Remove the instance from the JSON configuration
                        instances.splice(instanceId, 1);
                        fs.writeFileSync(configFile, JSON.stringify(instances, null, 2));
                        console.log(`Instance ${instance.name} has been deleted.`);
                    }, 3000); // Adjust the delay as needed
                } else {
                    // If the instance is not running, simply remove it from the JSON configuration
                    instances.splice(instanceId, 1);
                    fs.writeFileSync(configFile, JSON.stringify(instances, null, 2));
                    console.log(`Instance ${instance.name} has been deleted.`);
                }
            } else {
                console.error('Invalid instance ID. Use the "list" command to see available instances.');
            }
        } else {
            console.log('No MongoDB instances found.');
        }
    });

// Parse the command-line arguments
program.parse(process.argv);
