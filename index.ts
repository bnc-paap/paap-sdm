import { Configuration } from "@atomist/automation-client";
import { jenkinsPipelineSdm } from "./lib/sdm/jenkinsPipeline";

export const configuration = loadSdm();

async function loadSdm(): Promise<Configuration> {
    return jenkinsPipelineSdm;
}
