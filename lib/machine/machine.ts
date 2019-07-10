import { DefaultHttpClientFactory, NoParameters, Project } from "@atomist/automation-client";
import {
    Autofix, AutofixRegistration, CodeTransform,
    CommandHandlerRegistration, goals, hasFile, not, onAnyPush, PredicatePushTest, predicatePushTest,
    SoftwareDeliveryMachine,
    SoftwareDeliveryMachineConfiguration, whenPushSatisfies,
} from "@atomist/sdm";
import {
    Container,
    createSoftwareDeliveryMachine,
} from "@atomist/sdm-core";
import { Build } from "@atomist/sdm-pack-build";
import { DockerBuild, HasDockerfile } from "@atomist/sdm-pack-docker";
import { codeMetrics } from "@atomist/sdm-pack-sloc";
import { IsMaven, mavenBuilder, mavenPackage } from "@atomist/sdm-pack-spring";

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

    const mvnBuildJdk8 = new Container({ displayName: "Maven JDK8"})
        .with({
            containers: [{
                name: "mvn",
                image: "maven:3.6.1-jdk-8",
                command: ["mvn"],
                args: ["clean", "test", "-B", "-Dorg.slf4j.simpleLogger.log.org.apache.maven.cli.transfer.Slf4jMavenTransferListener=warn"],
            }],
        });

    sdm.withPushRules(
        onAnyPush().setGoals(mvnBuildJdk8),
    );

    return sdm;
}

export const helloWorldCommand: CommandHandlerRegistration = {
    name: "HelloWorld",
    description: "Responds with a friendly greeting to everyone",
    intent: "hello",
    listener: async ci => {
        await ci.addressChannels("Hello, world");
        return {code: 0};
    },
};

// const dockerBuild = new DockerBuild().with({
//     options: {push: false},
// });
//
// const dockerBuildGoals = goals("docker build")
//     .plan(dockerBuild);
//
// const mavenBuild = new Build({displayName: "maven build", isolate: true}).with({
//     name: "maven",
//     builder: mavenBuilder(),
// });
//
// const mavenBuildGoals = goals("build")
//     .plan(mavenBuild);

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
