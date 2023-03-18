import * as flashpoint from 'flashpoint-launcher';
import * as path from 'path';
import * as fs from 'fs';

const html5paths = [
	'FPSoftware\\fpnavigator-portable\\FPNavigator.exe',
	'FPSoftware\\Basilisk-Portable\\Basilisk-Portable.exe'
];

export function activate(context: flashpoint.ExtensionContext) {
	flashpoint.registerDisposable(
		context.subscriptions, 
		flashpoint.commands.registerCommand('core-curation.fix-requirements', async (curation: flashpoint.CurationState | null, selected: string[]) => {
			const html5platform = await flashpoint.games.findPlatformByName('HTML5');
			if (html5platform) {
				for (const folder of selected) {
					// Find curation
					const curation = flashpoint.curations.getCuration(folder);
					if (curation) {
						// Check for Basilisk path, swap to FP Navigator
						if (curation.game.applicationPath === 'FPSoftware\\Basilisk-Portable\\Basilisk-Portable.exe') {
							flashpoint.curations.setCurationGameMeta(curation.folder, {
								applicationPath: 'FPSoftware\\fpnavigator-portable\\FPNavigator.exe'
							});
						}
						// Check platforms, add HTML5 if missing
						if (html5paths.includes(curation.game.applicationPath || 'EMPTY')) {
							const html5exists = curation.game.platforms?.find(p => p.primaryAlias.name === 'HTML5');
							if (!html5exists) {
								// Add HTML5 to platforms
								const platforms = curation.game.platforms ? 
									curation.game.platforms.concat([html5platform]) :
									[html5platform];
								// Update curation
								flashpoint.curations.setCurationGameMeta(curation.folder, {
									platforms
								});
							}
						}
					}
				}
				flashpoint.log.info('Finished FP Nav Fix!');
			}
		})
	);

	flashpoint.registerDisposable(context.subscriptions, flashpoint.curations.onWillGenCurationWarnings((event) => {
		const { game } = event.curation;
		// Checks for HTTPS and non-existant launch command files
		if (game.launchCommand) {
			const launchWarns = invalidLaunchCommandWarnings(getContentFolder(event.curation.folder), game.launchCommand);
			for (const w of launchWarns) {
				event.warnings.writtenWarnings.push(w);
				event.warnings.fieldWarnings.push('launchCommand');
			}
		}
		
		// Warn of no notes of Hacked and Partial
		if (game.status && !game.notes) {
			if (game.status.includes('Hacked') || game.status.includes('Partial')) {
				event.warnings.writtenWarnings.push('documentStatus');
				event.warnings.fieldWarnings.push('notes');
			}
		}
	}));
}

// this method is called when your extension is deactivated (Currently unused)
export function deactivate() {}

function getContentFolder(folder: string): string {
	return path.join(flashpoint.curations.getCurationPath(folder), 'content');
}

function invalidLaunchCommandWarnings(folderPath: string, launchCommand: string): string[] {
	// Keep list of warns for end
	const warns: string[] = [];
	// Extract first string from launch command via regex
	const match = launchCommand.match(/[^\s"']+|"([^"]*)"|'([^']*)'/);
	if (match) {
	  // Match 1 - Inside quotes, Match 0 - No Quotes Found
	  let lc = match[1] || match[0];
	  // Extract protocol from potential URL
	  const protocol = lc.match(/(.+?):\/\//);
	  if (protocol) {
		// Protocol found, must be URL
		if (protocol[1] !== 'http') {
		  // Not using HTTP
		  warns.push('ilc_notHttp');
		}
		const ending = lc.split('/').pop();
		// If the string ends in file, cut off parameters
		if (ending && ending.includes('.')) {
		  lc = lc.split('?')[0];
		}
		const filePath = path.join(folderPath, unescape(lc).replace(/(^\w+:|^)\/\//, ''));
		// Push a game to the list if its launch command file is missing
		if (!fs.existsSync(filePath)) {
		  warns.push('ilc_nonExistant');
		}
	  }
	}
	return warns;
  }