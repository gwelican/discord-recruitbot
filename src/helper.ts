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

export class ParserConfig {
    classes: string[] = [];
    minIlvl: number | null = null;
    maxIlvl: number | null = null;
    neckLevel: number | null = null;
    realm: string | null = null;
    faction: string | null = null;
    channelId: string = '';

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

        parserConfig.classes = args['--classes'].toLocaleLowerCase().split(/,/);
    }
    return parserConfig;
}
