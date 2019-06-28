/*
 * Copyright © 2018 Atomist, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { DefaultHttpClientFactory, NoParameters, Project } from "@atomist/automation-client";
import {
    Autofix, AutofixRegistration, CodeTransform,
    CommandHandlerRegistration, goals, hasFile, not, onAnyPush, PredicatePushTest, predicatePushTest,
    SoftwareDeliveryMachine,
    SoftwareDeliveryMachineConfiguration, whenPushSatisfies,
} from "@atomist/sdm";
import {
    createSoftwareDeliveryMachine,
} from "@atomist/sdm-core";
import { Build } from "@atomist/sdm-pack-build";
import { DockerBuild } from "@atomist/sdm-pack-docker";
import { codeMetrics } from "@atomist/sdm-pack-sloc";
import { mavenBuilder, mavenPackage } from "@atomist/sdm-pack-spring";

/**
 * Initialize an sdm definition, and add functionality to it.
 *
 * @param configuration All the configuration for this service
 */
export function machine(
    configuration: SoftwareDeliveryMachineConfiguration,
): SoftwareDeliveryMachine {

    const sdm = createSoftwareDeliveryMachine({
        name: "Empty Seed Software Delivery Machine",
        configuration,
    });

    sdm.addExtensionPacks(
        codeMetrics(),
    );

    sdm.addCommand(helloWorldCommand);

    sdm.withPushRules(
        onAnyPush().setGoals(autofixGoal),
        whenPushSatisfies(IsMaven).setGoals(mavenBuildGoals),
        // whenPushSatisfies(HasDockerfile).setGoals(dockerBuild),
    );

    /*
     * this is a good place to type
    sdm.
     * and see what the IDE suggests for after the dot
     */

    return sdm;
}

export const helloWorldCommand: CommandHandlerRegistration = {
    name: "HelloWorld",
    description: "Responds with a friendly greeting to everyone",
    intent: "hello",
    listener: async ci => {
        await ci.addressChannels("Hello, world");
        return { code: 0 };
    },
};

const dockerBuild = new DockerBuild().with({
    options: { push: false },
})

export const HasDockerfile: PredicatePushTest = predicatePushTest(
    "Has Dockerfile",
    p => p.hasFile("Dockerfile"));

export const IsMaven: PredicatePushTest = predicatePushTest(
    "Is Maven",
    p => p.hasFile("pom.xml"));

const mavenBuild = new Build({ displayName: "maven build" }).with({
    name: "maven",
    builder: mavenBuilder(),
});

const mavenBuildGoals = goals("build")
    .plan(mavenBuild);

export const AddApacheLicenseFileTransform: CodeTransform<NoParameters> = async (p: Project) => {

    const httpClient = DefaultHttpClientFactory.create();
    const license = await httpClient.exchange("https://www.apache.org/licenses/LICENSE-2.0.txt");
    return p.addFile("LICENSE", license.body as string);
};

export const AddApacheLicenseFileAutofix: AutofixRegistration = {
    name: "add apache license file",
    transform: AddApacheLicenseFileTransform,
    pushTest: not(hasFile("LICENSE")),
    options: {
        ignoreFailure: false,
    },
};

const autofixGoal = new Autofix().with(AddApacheLicenseFileAutofix);
