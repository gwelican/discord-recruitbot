import * as fs from 'fs';
import {Moment} from 'moment';
import moment = require('moment');

class WowPlayer {
    name: string;
    realm: string;
    region: string;

    constructor(name: string, realm: string, region: string) {
        this.name = name;
        this.realm = realm;
        this.region = region;
    }
}

class CachedWowPlayer {
    player: WowPlayer;
    cached: Moment;

    constructor(player: WowPlayer, cached: Moment) {
        this.player = player;
        this.cached = cached;
    }
}

export class WowPersistance {
    private playerCache: CachedWowPlayer[] = [];

    private configPath = process.env.DATA_FILE;

    constructor() {
        this.load();
    }

    cache(region: string, realm: string, name: string) {
        const cachedWowPlayer = new CachedWowPlayer(new WowPlayer(name, realm, region), moment());
        this.playerCache.push(cachedWowPlayer);
    }

    isPlayerCached(region: string, realm: string, name: string) {
        if (this.playerCache.filter((wowlink) => {
            if (wowlink.player.name === name && wowlink.player.realm === realm && wowlink.player.region === region) {
                const now = moment();
                const minutesSinceCached = now.diff(moment(wowlink.cached), 'minutes');
                return minutesSinceCached <= parseInt(process.env.CACHE_EXPIRATION);
            }
        }).length > 0) {
            return true
        }
    }

    save() {
        const thisJson = JSON.stringify(this);
        fs.writeFileSync(this.configPath, thisJson);
    }

    load() {
        if (fs.existsSync(this.configPath)) {
            const data = fs.readFileSync(this.configPath, 'utf8');
            const parsed = JSON.parse(data) as WowPersistance;
            this.playerCache = parsed.playerCache;
        }
    }
}
