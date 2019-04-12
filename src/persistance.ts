import {Message} from 'discord.js';
import * as fs from 'fs';
import {Moment} from 'moment';
import {ParserConfig} from './helper';
import {log} from './main';
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
    channelid: string;

    constructor(player: WowPlayer, cached: Moment, channelid: string) {
        this.player = player;
        this.cached = cached;
        this.channelid = channelid;
    }
}

export class WowPersistance {
    private configs: ParserConfig[] = [];
    private playerCache: CachedWowPlayer[] = [];

    private configPath = process.env.DATA_FILE || '/tmp/playercache.json';

    constructor() {
        this.load();
    }

    public clearPreviousConfig(message: Message) {
        const lastConfigIndex = this.configs.findIndex((config: ParserConfig) => config.channelId === message.channel.id);
        log.info('clearing config for channel: ' + message.channel.id)
        if (lastConfigIndex !== -1) {
            message.channel.send('Overriding previous configuration.');
            this.configs.splice(lastConfigIndex, 1)
        }
    }

    addConfig(parserConfig: ParserConfig) {
        this.configs.push(parserConfig);
        this.save();
    }

    getConfigs() {
        return this.configs;
    }

    removeConfigForChannel(id: string) {
        this.configs = this.configs.filter((x) => x.channelId !== id)
        this.save();
    }

    cache(region: string, realm: string, name: string, channelid: string) {
        const cachedWowPlayer = new CachedWowPlayer(new WowPlayer(name, realm, region), moment(), channelid);
        this.playerCache.push(cachedWowPlayer);
        this.save();
    }

    isPlayerCached(region: string, realm: string, name: string, channelid: string) {
        return this.playerCache
            .find((item) =>
                item.player.name === name &&
                item.player.realm === realm &&
                item.player.region === region &&
                item.channelid == channelid
            )
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
            this.configs = parsed.configs;
        }
    }

    clean() {
        this.playerCache = this.playerCache.filter((item) => {
            const now = moment();
            const minutesSinceCached = now.diff(moment(item.cached), 'minutes');
            if (minutesSinceCached <= parseInt(process.env.CACHE_EXPIRATION || '10')) {
                return false
            }
            else {
                log.info(`Deleting entry: ${item.player.realm}-${item.player.name} for channel ${item.channelid} from cache`);
                return true
            }
        })
    }

    cleanCache() {
        this.playerCache = [];
        this.save();
    }
}
