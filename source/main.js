'use strict';
const electron = require('electron');
const util = require('./util');

const {ipcMain: ipc, BrowserWindow} = electron;

ipc.callRenderer = (window, channel, data) => new Promise((resolve, reject) => {
	const {sendChannel, dataChannel, errorChannel} = util.getRendererResponseChannels(window.id, channel);
	const id = `${Date.now()}-${Math.random()}`;
	const uniqueDataChannel = `${dataChannel}-${id}`;
	const uniqueErrorChannel = `${errorChannel}-${id}`;

	const cleanup = () => {
		ipc.removeAllListeners(uniqueDataChannel);
		ipc.removeAllListeners(uniqueErrorChannel);
	};

	ipc.on(uniqueDataChannel, (event, result) => {
		cleanup();
		resolve(result);
	});

	ipc.on(uniqueErrorChannel, (event, error) => {
		cleanup();
		reject(error);
	});

	const completeData = {
		uniqueDataChannel,
		uniqueErrorChannel,
		userData: data
	};

	if (window.webContents) {
		window.webContents.send(sendChannel, completeData);
	}
});

ipc.answerRenderer = (channel, callback) => {
	const {sendChannel} = util.getResponseChannels(channel);

	const listener = async (event, data) => {
		const window = BrowserWindow.fromWebContents(event.sender);

		const send = (channel, data) => {
			if (!(window && window.isDestroyed())) {
				event.sender.send(channel, data);
			}
		};

		const {uniqueDataChannel, uniqueErrorChannel, userData} = data;

		try {
			send(uniqueDataChannel, await callback(userData, window));
		} catch (error) {
			send(uniqueErrorChannel, error);
		}
	};

	ipc.on(sendChannel, listener);
	return () => {
		ipc.removeListener(sendChannel, listener);
	};
};

ipc.sendToRenderers = (channel, data) => {
	for (const window of BrowserWindow.getAllWindows()) {
		if (window.webContents) {
			window.webContents.send(channel, data);
		}
	}
};

module.exports = ipc;
