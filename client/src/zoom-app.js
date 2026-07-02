import zoomSdk from '@zoom/appssdk';

class ZoomApp {
    #context = '';
    #meetingUUID = '';
    #sdk = zoomSdk;
    #user = null;
    #video = {
        state: false,
        width: 0,
        height: 0,
    };

    get sdk() {
        return this.#sdk;
    }

    get context() {
        return this.#context;
    }

    get meetingUUID() {
        return this.#meetingUUID;
    }

    get user() {
        return this.#user;
    }

    get video() {
        return this.#video;
    }

    set video({ state, width, height }) {
        this.#video.state = state ?? (width !== 0 && height !== 0);
        if (width) this.#video.width = width;
        if (height) this.#video.height = height;
    }

    async init() {
        const conf = await this.sdk.config({
            capabilities: [
                'connect',
                'getMeetingUUID',
                'getRunningContext',
                'getUserContext',
                'onMyMediaChange',
                'setVirtualForeground',
            ],
        });

        if (conf.media?.video) this.video = conf.media.video;

        this.#context = conf.runningContext;

        this.sdk.onMyMediaChange(({ media: video }) => {
            this.video = video;
        });

        return conf;
    }

    async loadMeetingUUID() {
        const { meetingUUID } = await this.sdk.getMeetingUUID();
        this.#meetingUUID = meetingUUID;

        return meetingUUID;
    }

    async loadUserContext() {
        const user = await this.sdk.getUserContext();
        this.#user = user;

        return user;
    }
}

export default new ZoomApp();
