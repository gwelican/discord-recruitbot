import {Message} from 'discord.js';
import arg = require('arg');

export function getClassColor(wowclass: string): string {
    const colors = {
        'death knight': '#C41F3B',
        'demon hunter': '#A330C9',
        'druid': '#FF7D0A',
        'hunter': '#ABD473',
        'mage': '#40C7EB',
        'monk': '#00FF96',
        'paladin': '#F58CBA',
        'priest': '#FFFFFF',
        'rogue': '#FFF569',
        'shaman': '#0070DE',
        'warlock': '#8787ED',
        'warrior': '#C79C6E'
    } as any;
    return colors[wowclass.toLocaleLowerCase()];
}

export class GlobalConfig {
    private configs: ParserConfig[] = []

    public clearPreviousConfig(message: Message) {
        const lastConfigIndex = this.configs.findIndex((config: ParserConfig) => config.channelId === message.channel.id);
        console.log(this.configs);
        if (lastConfigIndex !== -1) {
            message.channel.send('Overriding previous configuration.');
            this.configs.splice(lastConfigIndex, 1)
        }
    }

    addConfig(parserConfig: ParserConfig) {
        this.configs.push(parserConfig);
    }

    getConfigs() {
        return this.configs;
    }

    removeConfigForChannel(id: string) {
        this.configs = this.configs.filter((x) => x.channelId !== id)
    }
}

export class ParserConfig {
    private _classes: Set<String>;
    private _minIlvl: number;
    private _maxIlvl: number;
    private _neckLevel: number;
    private _realm: string;
    private _faction: string;
    private _channelId: string;

    get classes(): Set<String> {
        return this._classes;
    }

    set classes(value: Set<String>) {
        this._classes = value;
    }

    get minIlvl(): number {
        return this._minIlvl;
    }

    set minIlvl(value: number) {
        this._minIlvl = value;
    }

    get maxIlvl(): number {
        return this._maxIlvl;
    }

    set maxIlvl(value: number) {
        this._maxIlvl = value;
    }

    get neckLevel(): number {
        return this._neckLevel;
    }

    set neckLevel(value: number) {
        this._neckLevel = value;
    }

    get realm(): string {
        return this._realm;
    }

    set realm(value: string) {
        this._realm = value;
    }

    get faction(): string {
        return this._faction;
    }

    set faction(value: string) {
        this._faction = value;
    }

    get channelId(): string {
        return this._channelId;
    }

    set channelId(value: string) {
        this._channelId = value;
    }

    public toString(): string {
        let output = [];
        if (this.faction) {
            output.push(`faction: ${this.faction}`)
        }
        if (this.minIlvl) {
            output.push(`min: ${this.minIlvl}`)
        }
        if (this.maxIlvl) {
            output.push(`max: ${this.maxIlvl}`)
        }
        if (this.realm) {
            output.push(`realm: ${this.realm}`)
        }
        if (this.neckLevel) {
            output.push(`neck: ${this.neckLevel}`)
        }
        if (this.classes) {
            output.push(`classes: ${Array.from(this.classes)}`)
        }
        return output.join(', ');
    }
}

export function parseCommandParameters(argv: string[]) {
    const args = arg({
        // Types
        '--min': Number,
        '--max': Number,
        '--classes': String,
        '--faction': String,
        '--realm': String,
        '--neck': Number
    }, {argv});
    const parserConfig = new ParserConfig();
    if (args['--max']) {
        parserConfig.maxIlvl = args['--max'];
    }
    if (args['--min']) {
        parserConfig.minIlvl = args['--min'];
    }
    if (args['--neck']) {
        parserConfig.neckLevel = args['--neck'];
    }
    if (args['--faction']) {
        parserConfig.faction = args['--faction'];
    }
    if (args['--realm']) {
        parserConfig.realm = args['--realm'];
    }
    if (args['--classes']) {
        args['--classes'].toLocaleLowerCase().split(/,/).forEach((cls) => {
                if (!getClassColor(cls)) {
                    const err = new Error(`Unknown class: ${cls}`) as any;
                    err.code = 'ARG_UNKNOWN_OPTION';
                    throw err;
                }
            }
        );
        parserConfig.classes = new Set(args['--classes'].toLocaleLowerCase().split(/,/));
    }
    return parserConfig;
}
