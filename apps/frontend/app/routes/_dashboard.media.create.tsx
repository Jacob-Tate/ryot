import {
	Anchor,
	Button,
	Code,
	Container,
	FileInput,
	Group,
	JsonInput,
	NumberInput,
	Select,
	Stack,
	Switch,
	TextInput,
	Textarea,
	Title,
} from "@mantine/core";
import {
	redirect,
	unstable_defineAction,
	unstable_defineLoader,
	unstable_parseMultipartFormData,
} from "@remix-run/node";
import type { MetaArgs_SingleFetch } from "@remix-run/react";
import { Form } from "@remix-run/react";
import {
	CreateCustomMetadataDocument,
	MediaLot,
} from "@ryot/generated/graphql/backend/graphql";
import { camelCase, changeCase, processSubmission } from "@ryot/ts-utils";
import { IconCalendar, IconPhoto, IconVideo } from "@tabler/icons-react";
import { $path } from "remix-routes";
import { z } from "zod";
import { useCoreDetails } from "~/lib/hooks";
import { s3FileUploader, serverGqlService } from "~/lib/utilities.server";

export const loader = unstable_defineLoader(async (_args) => {
	return {};
});

export const meta = (_args: MetaArgs_SingleFetch<typeof loader>) => {
	return [{ title: "Create Media | Ryot" }];
};

export const action = unstable_defineAction(async ({ request }) => {
	const uploaders = s3FileUploader("metadata");
	const formData = await unstable_parseMultipartFormData(request, uploaders);
	const submission = processSubmission(formData, schema);
	// biome-ignore lint/suspicious/noExplicitAny: required here
	const input: any = {
		...submission,
		[`${camelCase(submission.lot)}Specifics`]: submission.specifics
			? JSON.parse(submission.specifics)
			: undefined,
	};
	input.specifics = undefined;
	input.genres = input.genres?.split(",");
	input.creators = input.creators?.split(",");
	const { createCustomMetadata } = await serverGqlService.authenticatedRequest(
		request,
		CreateCustomMetadataDocument,
		{ input },
	);
	return redirect($path("/media/item/:id", { id: createCustomMetadata.id }));
});

const optionalString = z.string().optional();
const optionalStringArray = z.array(z.string()).optional();

const schema = z.object({
	title: z.string(),
	lot: z.nativeEnum(MediaLot),
	images: optionalStringArray,
	videos: optionalStringArray,
	description: optionalString,
	isNsfw: z.boolean().optional(),
	publishYear: z.number().optional(),
	genres: optionalString,
	creators: optionalString,
	specifics: optionalString,
});

export default function Page() {
	const coreDetails = useCoreDetails();
	const fileUploadNotAllowed = !coreDetails.fileStorageEnabled;

	return (
		<Container>
			<Form method="POST" encType="multipart/form-data">
				<Stack>
					<Title>Create Media</Title>
					<TextInput label="Title" required autoFocus name="title" />
					<Group wrap="nowrap">
						<Select
							label="Type"
							data={Object.values(MediaLot).map((v) => ({
								value: v,
								label: changeCase(v),
							}))}
							required
							name="lot"
						/>
						<Switch mt="md" label="Is it NSFW?" name="isNsfw" />
					</Group>
					<JsonInput
						label="Specifics"
						formatOnBlur
						name="specifics"
						description={
							<>
								Please search for <Code>Specifics</Code> inputs at the{" "}
								<Anchor href="/backend/graphql" size="xs" target="_blank">
									graphql endpoint
								</Anchor>{" "}
								for the required JSON structure
							</>
						}
					/>
					<Textarea
						label="Description"
						description="Markdown is supported"
						name="description"
					/>
					<FileInput
						label="Images"
						name="images"
						multiple
						disabled={fileUploadNotAllowed}
						description={
							fileUploadNotAllowed &&
							"Please set the S3 variables required to enable file uploading"
						}
						accept="image/png,image/jpeg,image/jpg"
						leftSection={<IconPhoto />}
					/>
					<FileInput
						label="Videos"
						name="videos"
						multiple
						disabled={fileUploadNotAllowed}
						description={
							fileUploadNotAllowed &&
							"Please set the S3 variables required to enable file uploading"
						}
						accept="video/mp4,video/x-m4v,video/*"
						leftSection={<IconVideo />}
					/>
					<NumberInput
						label="Publish year"
						leftSection={<IconCalendar />}
						name="publishYear"
					/>
					<TextInput
						label="Creators"
						placeholder="Comma separated names"
						name="creators"
					/>
					<TextInput
						label="Genres"
						placeholder="Comma separated values"
						name="genres"
					/>
					<Button type="submit">Create</Button>
				</Stack>
			</Form>
		</Container>
	);
}
