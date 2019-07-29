import { PushImpact, PushImpactListener, SdmContext, slackWarningMessage } from "@atomist/sdm";
import { SonarScan } from "@atomist/sdm-pack-sonarqube";
import { ExposedSecret, SecretSnifferOptions, sniffProjectSecrets } from "./secretSniffer";
import { loadSecretSnifferOptions } from "./secretSnifferOptionsLoader";

export const SonarScanGoal = new SonarScan();

async function renderExposedSecrets(exposedSecrets: ExposedSecret[], sdmc: SdmContext): Promise<any> {
    for (const es of exposedSecrets) {
        await sdmc.addressChannels(slackWarningMessage(es.repoRef.url + " sha:" + es.repoRef.sha,
            `Exposed secret: ${es.description} in \`${es.path}\``,
            sdmc.context));
    }
}

/**
 * On every push, scan for secrets
 * @return {PushImpactListener<{}>}
 */
function sniffForSecretsOnPush(opts: SecretSnifferOptions): PushImpactListener {
    return async pil => {
        const sniffed = await sniffProjectSecrets(
            opts.scanOnlyChangedFiles ? pil.impactedSubProject : pil.project,
            opts);
        await renderExposedSecrets(sniffed.exposedSecrets, pil);
    };
}

export const SecretSnifferGoal = new PushImpact()
    .withListener(sniffForSecretsOnPush(loadSecretSnifferOptions()));
