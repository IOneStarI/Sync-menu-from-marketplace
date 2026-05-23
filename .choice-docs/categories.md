# Categories

### 🚀 List
> `GET /menu/:language/categories/list/:sectionId`

Params:
<!-- schema-block-begin:/services/menu/categories/schema:params -->

 Property | Type | Description
 --- | --- | --- | 
language | string[2] | Current language (ex. en, de, cs)
sectionId | ObjectID | MongoDB objectID (string)
<!-- schema-block-end:/services/menu/categories/schema:params -->

Response: [Category schema[]](#category-schema)

### 🚀 Create
> `POST /menu/:language/categories`

Params:
<!-- schema-block-begin:/services/menu/schema:languageParams -->

 Property | Type | Description
 --- | --- | --- | 
language | string[2] | Current language (ex. en, de, cs)
<!-- schema-block-end:/services/menu/schema:languageParams -->

Payload:
<!-- schema-block-begin:/services/menu/categories/schema:createPayload -->

 Property | Type | Description
 --- | --- | --- | 
**name** * | string[1,100] | Name of category
**section** * | ObjectID | MongoDB objectID (string)
description | string[0,1000] | Description of category
active | boolean(=true) | Active flag
posID | string,null | Internal ID in external POS system
<!-- schema-block-end:/services/menu/categories/schema:createPayload -->

Response: [Category schema](#category-schema)


### 🚀 Get one
> `GET /menu/:language/categories/:_id`

Params:
<!-- schema-block-begin:/services/menu/categories/schema:idparams -->

 Property | Type | Description
 --- | --- | --- | 
language | string[2] | Current language (ex. en, de, cs)
_id | ObjectID | MongoDB objectID (string)
<!-- schema-block-end:/services/menu/categories/schema:idparams -->

Response: [Category schema](#category-schema)

### 🚀 Update
> `PUT /menu/:language/categories/:_id`

Params:
<!-- schema-block-begin:/services/menu/categories/schema:idparams -->

 Property | Type | Description
 --- | --- | --- | 
language | string[2] | Current language (ex. en, de, cs)
_id | ObjectID | MongoDB objectID (string)
<!-- schema-block-end:/services/menu/categories/schema:idparams -->

Payload:
<!-- schema-block-begin:/services/menu/categories/schema:updatePayload -->

 Property | Type | Description
 --- | --- | --- | 
**name** * | string[1,100] | Name of category
description | string[0,1000] | Description of category
active | boolean(=true) | Active flag
posID | string,null | Internal ID in external POS system
section | ObjectID | MongoDB objectID (string)
<!-- schema-block-end:/services/menu/categories/schema:updatePayload -->

Response: 204 HTTP code

### 🚀 Set categories position
> `POST /menu/:lang/categories/:sectionId/position/bulk`

Body (Array of CategoryId):
```angular2html
Example:
[
    "64f0b01705e18e3282dddc8e",
    "64ca2a7175d8dc85b892e535",
    "64f0b01205e18e3282dddc8a",
    "64f0b01505e18e3282dddc8c",    
    "64f0b01905e18e3282dddc90"
]
```

Response: 204 HTTP code

### 🚀 Delete
> `DELETE /menu/:language/categories/:_id`

Params:
<!-- schema-block-begin:/services/menu/categories/schema:idparams -->

 Property | Type | Description
 --- | --- | --- | 
language | string[2] | Current language (ex. en, de, cs)
_id | ObjectID | MongoDB objectID (string)
<!-- schema-block-end:/services/menu/categories/schema:idparams -->

Response: 204 HTTP code

### Category schema

<!-- schema-block-begin:/services/menu/categories/schema:schema -->

 Property | Type | Description
 --- | --- | --- | 
_id | ObjectID | MongoDB objectID (string)
name | string | Name of category
description | string[0,1000] | Description of category
active | boolean | Active flag
posID | string,null | Internal ID in external POS system
hurl | string | Human readable url
position | number | Current position
section | ObjectID | MongoDB objectID (string)
<!-- schema-block-end:/services/menu/categories/schema:schema -->

