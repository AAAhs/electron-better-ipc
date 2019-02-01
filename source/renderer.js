'use strict';
const electron = require('electron');
const util = require('./util');

const {ipcRenderer: ipc} = electron;

ipc.callMain = (channel, data) => new Promise((resolve, reject) => {
	const {sendChannel, dataChannel, errorChannel} = util.getResponseChannels(channel);
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

	ipc.send(sendChannel, completeData);
});

ipc.answerMain = (channel, callback) => {
	const window = electron.remote.getCurrentWindow();
	const {sendChannel} = util.getRendererResponseChannels(window.id, channel);

	const listener = async (event, data) => {
		const {uniqueDataChannel, uniqueErrorChannel, userData} = data;

		try {
			ipc.send(uniqueDataChannel, await callback(userData));
		} catch (error) {
			ipc.send(uniqueErrorChannel, error);
		}
	};

	ipc.on(sendChannel, listener);
	return () => {
		ipc.removeListener(sendChannel, listener);
	};
};

module.exports = ipc;
