# Section info message

### 🚀 List
> `GET /menu/:language/section-info/:sectionId`

Params:
<!-- schema-block-begin:/services/menu/section-info/schema:params -->

 Property | Type | Description
 --- | --- | --- | 
language | string[2] | Current language (ex. en, de, cs)
sectionId | ObjectID | MongoDB objectID (string)
<!-- schema-block-end:/services/menu/section-info/schema:params -->

Response: [Section info schema](#section-info-schema)

### Section info schema

<!-- schema-block-begin:/services/menu/section-info/schema:schema -->

 Property | Type | Description
 --- | --- | --- | 
_id | ObjectID | MongoDB objectID (string)
value | string | Section info message
section | ObjectID | MongoDB objectID (string)
<!-- schema-block-end:/services/menu/section-info/schema:schema -->

