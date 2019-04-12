import * as cheerio from 'cheerio';
import Discord, {Message, RichEmbed} from 'discord.js';
import * as e6p from 'es6-promise';
import fetch from 'isomorphic-fetch';
import {scheduleJob} from 'node-schedule';
import {combineLatest, from, Observable, of} from 'rxjs';
import {catchError} from 'rxjs/internal/operators';
import {getClassColor, GlobalConfig, parseCommandParameters, ParserConfig} from './helper';
import {WowPersistance} from './Persistance';
import {fetchRaiderio, RaiderIORank} from './raiderio';
import {fetchWcl, WarcraftLogsRankingScore} from './warcraftlogs';
import {fetchWowprogress, WowprogressResult} from './wowprogress';

require('dotenv').config();

const client = new Discord.Client();

client.on('ready', () => {
    console.log('Bot has started');
});

const config = new GlobalConfig();

const persistance = new WowPersistance();

client.on('message', (message: Message) => {
    if (message.content.match('^!stop')) {
        config.removeConfigForChannel(message.channel.id);
        message.channel.send('Okay, I stopped the LFG feed report on this channel.');
        return
    }
    if (message.content.match('^!start')) {
        if (message.content.match('^!start help')) {
            const richEmbed = new RichEmbed();
            richEmbed.setTitle('Wowprogress feed help');
            richEmbed.addField('--min', 'set the minimum item level to report\nexample: --min 400');
            richEmbed.addField('--max', 'set the maximum item level to report\nexample: --max 415');
            richEmbed.addField('--classes', 'only report players with any of these classes(coma separated list)\nexample: --classes hunter,warlock');
            richEmbed.addField('--faction', 'only report players with this faction\nexample: --faction alliance');
            richEmbed.addField('--realm', 'only report players from this realm\nexample: --realm lightbringer');
            richEmbed.addField('--neck', 'set the minimum neck level to report\nexample: --neck 42');
            message.channel.send(richEmbed);
            return;
        }
        const argv = message.content.split(/ /).splice(1);
        try {
            const parserConfig = parseCommandParameters(argv);
            parserConfig.channelId = message.channel.id;
            config.clearPreviousConfig(message);
            config.addConfig(parserConfig);
            message.channel.send('Okay I will spam your channel with potential recruits, based on the following config: [' + parserConfig + ']. Btw I report every 10 minutes.');
            getLFGPlayers();
        }
        catch (err) {
            if (err.code === 'ARG_UNKNOWN_OPTION') {
                message.channel.send(err.message);
            }
        }

    }
    if (message.content.match(/^!fetch.+/)) {
        console.log(message);
        const [command, characterRealm, characterName] = message.content.split(/ /);
        getPlayerDetails('us', characterRealm, characterName).subscribe(
            player => {
                message.channel.send(player);
            }
        );
    }
})
;

client.on('error', e => {
    console.error('Discord client error!', e);
});

function createProgress(progress: any): string {
    if (progress['mythic'] > 0) {
        return progress['mythic'] + '/9 M';
    }
    else if (progress['heroic'] > 0) {
        return progress['heroic'] + '/9 H';
    }
    else if (progress['normal'] > 0) {
        return progress['normal'] + '/9 N';
    }
    else {
        return 'N/A';
    }
}

function capitalize(text: string): string {
    return text.charAt(0).toUpperCase() + text.slice(1)
}

function convertPlayerToRichEmbed(name: string, realm: string, raiderio: RaiderIORank, wowprogress: WowprogressResult, region: string, wcl: WarcraftLogsRankingScore) {
    const embed = new RichEmbed()
        .setTitle(`${capitalize(name)} @ ${capitalize(realm)} - ${capitalize(raiderio !== null ? raiderio.faction : '')}`)
        .setColor(getClassColor(wowprogress.wowclass))

        .setDescription(`[${capitalize(wowprogress.wowclass)} ${wowprogress.ilvl} ${createProgress(wowprogress.progress)}](https://www.wowprogress.com/character/${region}/${realm}/${name})
                                    
                         [Armory](https://worldofwarcraft.com/en-us/character/${region}/${realm}/${name})
                         [Logs](https://www.warcraftlogs.com/character/id/12534031)`);

    if (raiderio && raiderio.mythicPlusScore) {
        embed.addField('Raiderio: ', raiderio.mythicPlusScore)
    }
    if (wowprogress) {
        embed.addField('Neck level', wowprogress.neckLevel)
    }
    if (wowprogress && wowprogress.specsPlaying) {
        embed.addField('Specs', wowprogress.specsPlaying)
    }
    if (wowprogress && wowprogress.ilvl) {
        embed.addField('Ilvl', wowprogress.ilvl)
    }
    if (wowprogress && wowprogress.raidTimes) {
        embed.addField('Raid times', wowprogress.raidTimes)
    }
    if (wowprogress && wowprogress.lfg) {
        embed.addField('LFG status', wowprogress.lfg)
    }
    if (wowprogress && wowprogress.battleTag) {
        embed.addField('Battletag', wowprogress.battleTag)
    }
    if (wcl && wcl.mythicScores) {
        embed.addField('M WCL', wcl.mythicScores)
    }
    if (wcl && wcl.heroicScores) {
        embed.addField('H WCL', wcl.heroicScores)
    }
    if (wowprogress && wowprogress.comments) {
        embed.addField('Comments', wowprogress.comments.slice(0, 300))
    }
    return embed;
}

function getPlayerDetails(region: string, realm: string, name: string): Observable<RichEmbed> {
    return new Observable(obs => {
        if (!name.includes('%')) {
            const characterStat = combineLatest(
                fetchWowprogress(region, realm, name),
                fetchWcl(region, realm, name).pipe(catchError(err => of(null))),
                fetchRaiderio(region, realm, name).pipe(catchError(err => of(null)))
            );

            characterStat.subscribe(
                ([wowprogress, wcl, raiderio]: [WowprogressResult, WarcraftLogsRankingScore, RaiderIORank]) => {
                    const embed = convertPlayerToRichEmbed(name, realm, raiderio, wowprogress, region, wcl);
                    obs.next(embed);
                });
        }
    });
}

function shouldNotify(cfg: ParserConfig, raiderio: RaiderIORank, wowprogress: WowprogressResult) {
    if (!cfg.faction || raiderio.faction.toLowerCase() === cfg.faction.toLowerCase()) {
        if (!cfg.minIlvl || wowprogress.ilvl > cfg.minIlvl) {
            if (!cfg.maxIlvl || wowprogress.ilvl < cfg.maxIlvl) {
                if (!cfg.classes || cfg.classes.has(wowprogress.wowclass.toLocaleLowerCase())) {
                    if (!cfg.neckLevel || cfg.neckLevel <= wowprogress.neckLevel) {
                        return true;
                    }
                    else {
                        console.log('neck level filter')
                    }
                }
                else {
                    console.log('class filter')
                }
            }
            else {
                console.log('max ilvl filter')
            }
        }
        else {
            console.log('min ilvl filter')
        }
    }
    else {
        console.log('faction filter')
    }
}

export function parseLink(link: string) {
    return link.substr(11).split('/');
}

function getLFGPlayers() {
    console.log('fetching LFG');
    config.getConfigs().forEach((cfg) => {
        console.log(`checking channel: ${cfg.channelId}`);
        const data$ = from(
            fetch('https://www.wowprogress.com/gearscore/?lfg=1&sortby=ts')
                .then(resp => resp.ok ? resp.text() : Promise.reject(`${resp.statusText} ${resp.status}`))
        );

        data$.subscribe(body => {
            const $ = cheerio.load(body);
            const links = $('a.character').map((i, e) => e.attribs['href']).get();
            links.forEach(link => {
                const [region, realm, name] = parseLink(link);
                console.log(link);
                if (region.toLocaleLowerCase() === 'us') {
                    if (!cfg.realm || cfg.realm.toLowerCase() === realm.toLowerCase()) {
                        const characterStat = combineLatest(
                            fetchWowprogress(region, realm, name),
                            fetchWcl(region, realm, name).pipe(catchError(err => of(null))),
                            fetchRaiderio(region, realm, name).pipe(catchError(err => of(null)))
                        );
                        characterStat.subscribe(([wowprogress, wcl, raiderio]: [WowprogressResult, WarcraftLogsRankingScore, RaiderIORank]) => {
                            if (!persistance.isPlayerCached(region, realm, name) && shouldNotify(cfg, raiderio, wowprogress)) {
                                const richEmbed = convertPlayerToRichEmbed(name, realm, raiderio, wowprogress, region, wcl);
                                (client.channels.get(cfg.channelId) as Discord.TextChannel).send(richEmbed);
                                persistance.cache(region, realm, name);
                                persistance.save();
                            }
                        });
                    }
                    else {
                        console.log(`skipping ${link} because of realm is not ${realm}`)
                    }
                }
            });
        });
    })

}

scheduleJob('*/10 * * * ', () => {
    getLFGPlayers();
});

getLFGPlayers();

client.login(process.env.DISCORD_TOKEN);
