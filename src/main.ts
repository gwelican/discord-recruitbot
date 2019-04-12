import * as cheerio from 'cheerio';
import Discord, {Message, RichEmbed} from 'discord.js';
import fetch from 'isomorphic-fetch';
import {scheduleJob} from 'node-schedule';
import {combineLatest, from, Observable, of} from 'rxjs';
import {catchError} from 'rxjs/internal/operators';
import {Category, CategoryConfiguration, CategoryServiceFactory, LogLevel} from 'typescript-logging';
import {getClassColor, parseCommandParameters, ParserConfig} from './helper';
import {WowPersistance} from './persistance';
import {fetchRaiderio, RaiderIORank} from './raiderio';
import {fetchWcl, WarcraftLogsRankingScore} from './warcraftlogs';
import {fetchWowprogress, WowprogressResult} from './wowprogress';

require('dotenv').config();

CategoryServiceFactory.setDefaultConfiguration(new CategoryConfiguration(LogLevel.Info));
export const log = new Category('recruitbot');

const client = new Discord.Client();

client.on('ready', () => {
    log.info('Bot started');
});

const persistance = new WowPersistance();

client.on('message', (message: Message) => {
    if (message.content.match('^!stop')) {
        persistance.removeConfigForChannel(message.channel.id);
        message.channel.send('Okay, I stopped the LFG feed report on this channel.');
        return
    }
    if (message.content.match('^!wipecache')) {
        persistance.cleanCache();
        message.channel.send('Cache wiped');
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
            persistance.clearPreviousConfig(message);
            persistance.addConfig(parserConfig);
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
        log.info(`Got fetch command: ${message.content}`)
        const [command, characterRealm, characterName] = message.content.split(/ /);
        getPlayerDetails('us', characterRealm, characterName).subscribe(
            player => {
                message.channel.send(player);
            }
        );
    }
});

client.on('error', e => {
    log.error('Discord client error!', e);
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

function convertPlayerToRichEmbed(name: string, realm: string, raiderio: RaiderIORank | null, wowprogress: WowprogressResult, region: string, wcl: WarcraftLogsRankingScore | null) {
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
                ([wowprogress, wcl, raiderio]: [WowprogressResult, WarcraftLogsRankingScore | null, RaiderIORank | null]) => {
                    const embed = convertPlayerToRichEmbed(name, realm, raiderio, wowprogress, region, wcl);
                    obs.next(embed);
                });
        }
    });
}

function shouldNotify(cfg: ParserConfig, raiderio: RaiderIORank | null, wowprogress: WowprogressResult) {
    if (cfg.faction == null || !raiderio || raiderio.faction.toLowerCase() === cfg.faction.toLowerCase()) {
        if (cfg.minIlvl == null || wowprogress.ilvl > cfg.minIlvl) {
            if (cfg.maxIlvl == null || wowprogress.ilvl < cfg.maxIlvl) {
                if (cfg.classes.length == 0 || cfg.classes.includes(wowprogress.wowclass.toLowerCase())) {
                    if (cfg.neckLevel == null || cfg.neckLevel <= wowprogress.neckLevel) {
                        return true;
                    }
                    else {
                        log.debug('neck filter errored out');
                    }
                }
                else {
                    log.debug('class filter errored out');
                }
            }
            else {
                log.debug('max ilvl filter errored out');
            }
        }
        else {
            log.debug('min ilvl filter errored out');
        }
    }
    else {
        log.debug('faction filter errored out');
    }
}

export function parseLink(link: string) {
    return link.substr(11).split('/');
}

function getLFGPlayers() {
    console.log(persistance.getConfigs())
    log.info('Fetching LFG');
    persistance.getConfigs().forEach((cfg) => {
        log.info(`checking channel: ${cfg.channelId}`);
        const data$ = from(
            fetch('https://www.wowprogress.com/gearscore/?lfg=1&sortby=ts')
                .then(resp => resp.ok ? resp.text() : Promise.reject(`${resp.statusText} ${resp.status}`))
        );

        data$.subscribe(body => {
            const $ = cheerio.load(body);
            const links = $('a.character').map((i, e) => e.attribs['href']).get();
            console.log(links);
            links.forEach(link => {
                const [region, realm, name] = parseLink(link);
                log.info(link);
                if (region.toLocaleLowerCase() === 'us') {
                    if (cfg.realm == null || cfg.realm.toLowerCase() === realm.toLowerCase()) {
                        const characterStat = combineLatest(
                            fetchWowprogress(region, realm, name),
                            fetchWcl(region, realm, name).pipe(catchError(err => of(null))),
                            fetchRaiderio(region, realm, name).pipe(catchError(err => of(null)))
                        );
                        characterStat.subscribe(([wowprogress, wcl, raiderio]: [WowprogressResult, WarcraftLogsRankingScore | null, RaiderIORank | null]) => {
                            if (!persistance.isPlayerCached(region, realm, name, cfg.channelId) && shouldNotify(cfg, raiderio, wowprogress)) {
                                const richEmbed = convertPlayerToRichEmbed(name, realm, raiderio, wowprogress, region, wcl);
                                (client.channels.get(cfg.channelId) as Discord.TextChannel).send(richEmbed);
                                persistance.cache(region, realm, name, cfg.channelId);
                                persistance.save();
                            }
                        });
                    }
                    else {
                        log.info(`skipping ${link} because of realm is not ${realm}`)
                    }
                }
            });
        }, (err) => {
            log.error('Wowprogress error!', err)
        });
    })
}

scheduleJob('*/1 * * * ', () => {
    getLFGPlayers();
});

scheduleJob('*/10 * * * ', () => {
    persistance.clean();
});

getLFGPlayers();

client.login(process.env.DISCORD_TOKEN);
