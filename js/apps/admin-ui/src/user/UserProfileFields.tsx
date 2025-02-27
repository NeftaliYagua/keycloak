import type {
  UserProfileAttributeGroupMetadata,
  UserProfileAttributeMetadata,
  UserProfileMetadata,
} from "@keycloak/keycloak-admin-client/lib/defs/userProfileMetadata";
import { Text } from "@patternfly/react-core";
import { useMemo } from "react";
import { FieldPath, UseFormReturn } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { ScrollForm } from "../components/scroll-form/ScrollForm";
import { OptionComponent } from "./components/OptionsComponent";
import { SelectComponent } from "./components/SelectComponent";
import { TextAreaComponent } from "./components/TextAreaComponent";
import { TextComponent } from "./components/TextComponent";
import { UserFormFields } from "./form-state";
import { fieldName, isRootAttribute } from "./utils";
import { MultiInputComponent } from "./components/MultiInputComponent";

export type UserProfileError = {
  responseData: { errors?: { errorMessage: string }[] };
};

export type Options = {
  options?: string[];
};

export function isUserProfileError(error: unknown): error is UserProfileError {
  return !!(error as UserProfileError).responseData.errors;
}

export function userProfileErrorToString(error: UserProfileError) {
  return (
    error.responseData["errors"]?.map((e) => e["errorMessage"]).join("\n") || ""
  );
}

const INPUT_TYPES = [
  "text",
  "textarea",
  "select",
  "select-radiobuttons",
  "multiselect",
  "multiselect-checkboxes",
  "html5-email",
  "html5-tel",
  "html5-url",
  "html5-number",
  "html5-range",
  "html5-datetime-local",
  "html5-date",
  "html5-month",
  "html5-time",
  "multi-input",
] as const;

const MULTI_VALUED_INPUT_TYPES: readonly string[] = [
  "multiselect",
  "multiselect-checkboxes",
  "multi-input",
] satisfies InputType[];

export type InputType = (typeof INPUT_TYPES)[number];

export type UserProfileFieldProps = {
  form: UseFormReturn<UserFormFields>;
  inputType: InputType;
  attribute: UserProfileAttributeMetadata;
  roles: string[];
};

export const FIELDS: {
  [type in InputType]: (props: UserProfileFieldProps) => JSX.Element;
} = {
  text: TextComponent,
  textarea: TextAreaComponent,
  select: SelectComponent,
  "select-radiobuttons": OptionComponent,
  multiselect: SelectComponent,
  "multiselect-checkboxes": OptionComponent,
  "html5-email": TextComponent,
  "html5-tel": TextComponent,
  "html5-url": TextComponent,
  "html5-number": TextComponent,
  "html5-range": TextComponent,
  "html5-datetime-local": TextComponent,
  "html5-date": TextComponent,
  "html5-month": TextComponent,
  "html5-time": TextComponent,
  "multi-input": MultiInputComponent,
} as const;

export type UserProfileFieldsProps = {
  form: UseFormReturn<UserFormFields>;
  userProfileMetadata: UserProfileMetadata;
  roles?: string[];
  hideReadOnly?: boolean;
};

type GroupWithAttributes = {
  group: UserProfileAttributeGroupMetadata;
  attributes: UserProfileAttributeMetadata[];
};

export const UserProfileFields = ({
  form,
  userProfileMetadata,
  roles = ["admin"],
  hideReadOnly = false,
}: UserProfileFieldsProps) => {
  const { t } = useTranslation();
  // Group attributes by group, for easier rendering.
  const groupsWithAttributes = useMemo(() => {
    // If there are no attributes, there is no need to group them.
    if (!userProfileMetadata.attributes) {
      return [];
    }

    // Hide read-only attributes if 'hideReadOnly' is enabled.
    const attributes = hideReadOnly
      ? userProfileMetadata.attributes.filter(({ readOnly }) => !readOnly)
      : userProfileMetadata.attributes;

    return [
      // Insert an empty group for attributes without a group.
      { name: undefined },
      ...(userProfileMetadata.groups ?? []),
    ].map<GroupWithAttributes>((group) => ({
      group,
      attributes: attributes.filter(
        (attribute) => attribute.group === group.name,
      ),
    }));
  }, [
    hideReadOnly,
    userProfileMetadata.groups,
    userProfileMetadata.attributes,
  ]);

  if (groupsWithAttributes.length === 0) {
    return null;
  }

  return (
    <ScrollForm
      sections={groupsWithAttributes
        .filter((group) => group.attributes.length > 0)
        .map(({ group, attributes }) => ({
          title: group.displayHeader || group.name || t("general"),
          panel: (
            <div className="pf-c-form">
              {group.displayDescription && (
                <Text className="pf-u-pb-lg">{group.displayDescription}</Text>
              )}
              {attributes.map((attribute) => (
                <FormField
                  key={attribute.name}
                  form={form}
                  attribute={attribute}
                  roles={roles}
                />
              ))}
            </div>
          ),
        }))}
    />
  );
};

type FormFieldProps = {
  form: UseFormReturn<UserFormFields>;
  attribute: UserProfileAttributeMetadata;
  roles: string[];
};

const FormField = ({ form, attribute, roles }: FormFieldProps) => {
  const value = form.watch(fieldName(attribute) as FieldPath<UserFormFields>);
  const inputType = determineInputType(attribute, value);
  const Component = FIELDS[inputType];

  return (
    <Component
      form={form}
      inputType={inputType}
      attribute={attribute}
      roles={roles}
    />
  );
};

function determineInputType(
  attribute: UserProfileAttributeMetadata,
  value: string | string[],
): InputType {
  // Always treat the root attributes as a text field.
  if (isRootAttribute(attribute.name)) {
    return "text";
  }

  const inputType = attribute.annotations?.inputType;

  // If the attribute has no valid input type, fall back to a default input type.
  // Depending on the length of the value, we either use a 'multi-input' or a 'text' input type so all values are always visible.
  if (!isValidInputType(inputType)) {
    return Array.isArray(value) && value.length > 1 ? "multi-input" : "text";
  }

  // If the input type is multi-valued, we don't have to do any further checks, as we know all values will always show up.
  if (MULTI_VALUED_INPUT_TYPES.includes(inputType)) {
    return inputType;
  }

  // An attribute with multiple values is always as a 'multi-input', even if a singular input type is provided.
  // This is done so that the user can edit the attribute without accidentally truncating the other values that would otherwise be hidden.
  if (Array.isArray(value) && value.length > 1) {
    return "multi-input";
  }

  return inputType;
}

const isValidInputType = (value: unknown): value is InputType =>
  typeof value === "string" && value in FIELDS;
