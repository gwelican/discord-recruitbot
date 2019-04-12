import fetch from 'isomorphic-fetch';
import * as _ from 'lodash';
import {from, Observable} from 'rxjs';
import {log} from './main';

export class WclRanking {
    spec: string | null = null;
    // encounterName: string | null = null;
    percentile: number = 0;
    // rank: number | null = null;
    // outOf: number | null = null;
    difficulty: number = 0;
    // characterID: number | null = null;
}

export class SpecScore {
    score: number;
    name: string;

    constructor(name: string, score: number) {
        this.name = name;
        this.score = score
    }

    public toString(): string {
        return this.name + ' => ' + this.score.toFixed(2) + '%';
    }
}

export class WarcraftLogsRankingScore {

    constructor(normalScores: SpecScore[], heroicScores: SpecScore[], mythicScores: SpecScore[]) {
        this.normalScores = normalScores;
        this.heroicScores = heroicScores;
        this.mythicScores = mythicScores;
    }

    normalScores: SpecScore[];
    heroicScores: SpecScore[];
    mythicScores: SpecScore[];

    public toString(): string {
        let output = '';
        if (this.heroicScores) {
            output += 'Heroic WCL';
            output += _.map(this.heroicScores, (i: SpecScore) => {
                return i.name + ' => ' + i.score.toFixed(2) + '%\n';
            }).join('\n');
        }
        if (this.mythicScores) {
            output += 'Mythic WCL';
            output += _.map(this.heroicScores, (i: SpecScore) => {
                return i.name + ' => ' + i.score.toFixed(2) + '%\n';
            }).join('\n');
        }
        return output;
    }

}

export function fetchWcl(serverRegion: string, serverName: string, characterName: string): Observable<WarcraftLogsRankingScore> {
    log.info(`http://warcraftlogs.com/v1/rankings/character/${characterName}/${serverName}/${serverRegion}?api_key=${process.env.WCL_TOKEN}`);

    const data$ = from(
        fetch(`http://warcraftlogs.com/v1/rankings/character/${characterName}/${serverName}/${serverRegion}?api_key=${process.env.WCL_TOKEN}`)
            .then(resp => {
                return resp.ok ? resp.json() : Promise.reject(`Error in rankings: ${resp.statusText} ${resp.status}`)
            })
    );
    return new Observable(obs => {

        data$.subscribe((body: WclRanking[]) => {
            const percentiles = _.groupBy(body, (x: WclRanking) => x.difficulty);
            const diffSpecScore = _.fromPairs(_.map(_.keys(percentiles), (diff) => {
                const specGrouped = _.groupBy(percentiles[diff], (ranking: WclRanking) => ranking.spec);
                return [
                    diff,
                    _.map(_.keys(specGrouped), (specName) => {
                        return new SpecScore(specName, _.sumBy(specGrouped[specName], (c: WclRanking) => c.percentile / specGrouped[specName].length));
                    })
                ];
            }));
            obs.next(new WarcraftLogsRankingScore(diffSpecScore[3], diffSpecScore[4], diffSpecScore[5]));
        }, (err) => {
            obs.error(err);
        });
    });

}

