import {
    GoalInvocation,
    hasFile,
    isMaterialChange,
} from "@atomist/sdm";
import { configure } from "@atomist/sdm-core";
import {
    jenkins,
    JenkinsRegistration,
} from "@atomist/sdm-pack-jenkins";
import { sonarQubeSupport, SonarScan } from "@atomist/sdm-pack-sonarqube";
import * as fs from "fs-extra";
import * as hbx from "handlebars";
import * as path from "path";
import { SpringBootGenerator } from "./springBootGenerator";

/**
 * Atomist SDM Sample
 * @description SDM to demonstrate how to run and converge Jenkins jobs
 * @tag sdm,jenkins,maven
 * @instructions <p>Now that the SDM is up and running, make a commit to a Maven
 *               repository that has an Atomist webhook configured. You can observe
 *               the Jenkins goal from chat or https://app.atomist.com.
 *
 *               Note: Please configure the following environment variables so that
 *               this SDM can access your Jenkins instance: JENKINS_URL, JENKINS_USER
 *               and JENKINS_PASSWORD.</p>
 */

const materialChanges = {
    java: {
        extenisons: [
            "java",
        ],
        files: [
            "pom.xml",
            "build.gradle",
        ],
    },
};

const javaExtensions = [
    "java",
];

const javaFiles = [
    "pom.xml",
    "build.gradle",
];

// atomist:code-snippet:start=sdm
/**
 * Main entry point into the SDM
 */
export const jenkinsPipelineSdm = configure(async sdm => {
    // Extension packs
    const SonarScanGoal = new SonarScan();
    sdm.addExtensionPacks(sonarQubeSupport(SonarScanGoal));

    // Generators
    sdm.addGeneratorCommand(SpringBootGenerator);

    // The Jenkins goal needs access to the Jenkins master which
    // can be configured below
    const options: Pick<JenkinsRegistration, "server"> = {
        server: {
            url: process.env.JENKINS_URL || "http://127.0.0.1:8880",
            user: process.env.JENKINS_USER || "admin",
            password: process.env.JENKINS_PASSWORD || "admin",
        },
    };

    // Jenkins goal that runs a job named <repo_name>-build which will be
    // created or updated with a job definition returned by the mavenPipeline
    // function
    const build = jenkins("build", {
        ...options,
        job: async gi => `${gi.goalEvent.repo.owner}_${gi.goalEvent.repo.name}-build-pipeline-test`,
        // job: async gi => `7807/nonproduction/${gi.goalEvent.repo.owner}_${gi.goalEvent.repo.name}-build`,
        definition: async gi => mavenPipeline(gi),
    });

    return {
        "jenkins-ci": {
            test: [
                hasFile("Jenkinsfile"),
                isMaterialChange({
                    extensions: [
                        "properties",
                        "yaml",
                        ...javaExtensions,
                    ],
                    files: [
                        "Jenkinsfile",
                        "Dockerfile",
                        ...javaFiles,
                    ],
                })],
            goals: [
                SonarScanGoal,
                build,
            ],
        },
    };
}, {name: "jenkins"});

/**
 * Load the job definition from a local XML template
 */
async function mavenPipeline(gi: GoalInvocation): Promise<string> {
    const template = (await fs.readFile(path.join(__dirname, "jenkins.pipeline.xml"))).toString();
    const hb = hbx.compile(template);
    return hb({gi});
}
