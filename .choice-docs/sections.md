# Sections

### 🚀 List
> `GET /menu/:language/sections/list`

Params:
<!-- schema-block-begin:/services/menu/sections/schema:params -->

 Property | Type | Description
 --- | --- | --- | 
language | string[2] | Current language (ex. en, de, cs)
<!-- schema-block-end:/services/menu/sections/schema:params -->

Response: [Section schema[]](#section-schema)

### 🚀 Get one 
> `GET /menu/:language/sections/:_id`

Params:
<!-- schema-block-begin:/services/menu/sections/schema:idparams -->

 Property | Type | Description
 --- | --- | --- | 
language | string[2] | Current language (ex. en, de, cs)
_id | ObjectID | MongoDB objectID (string)
<!-- schema-block-end:/services/menu/sections/schema:idparams -->

Response: [Section schema](#section-schema)

### 🚀 Create 
> `POST /menu/:language/sections`

Params:
<!-- schema-block-begin:/services/menu/sections/schema:params -->

 Property | Type | Description
 --- | --- | --- | 
language | string[2] | Current language (ex. en, de, cs)
<!-- schema-block-end:/services/menu/sections/schema:params -->

Payload: 
<!-- schema-block-begin:/services/menu/sections/schema:payload -->

 Property | Type | Description
 --- | --- | --- | 
**name** * | string[1,100] | Name of section
description | string[0,1000] | Description of section
active | boolean(=true) | Active flag
posID | string,null | Internal ID in external POS system
<!-- schema-block-end:/services/menu/sections/schema:payload -->

Response: [Section schema](#section-schema)

### 🚀 Update
> `PUT /menu/:language/sections/:_id`

Params:
<!-- schema-block-begin:/services/menu/sections/schema:idparams -->

 Property | Type | Description
 --- | --- | --- | 
language | string[2] | Current language (ex. en, de, cs)
_id | ObjectID | MongoDB objectID (string)
<!-- schema-block-end:/services/menu/sections/schema:idparams -->

Payload:
<!-- schema-block-begin:/services/menu/sections/schema:payload -->

 Property | Type | Description
 --- | --- | --- | 
**name** * | string[1,100] | Name of section
description | string[0,1000] | Description of section
active | boolean(=true) | Active flag
posID | string,null | Internal ID in external POS system
<!-- schema-block-end:/services/menu/sections/schema:payload -->

Response: 204 HTTP code

### 🚀 Set sections position
> `POST /menu/:lang/sections/position/bulk`

Body (Array of SectionId): 
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
> `DELETE /menu/:language/sections/:_id`

Params:
<!-- schema-block-begin:/services/menu/sections/schema:idparams -->

 Property | Type | Description
 --- | --- | --- | 
language | string[2] | Current language (ex. en, de, cs)
_id | ObjectID | MongoDB objectID (string)
<!-- schema-block-end:/services/menu/sections/schema:idparams -->

Response: 204 HTTP code

### Section schema

<!-- schema-block-begin:/services/menu/sections/schema:schema -->

 Property | Type | Description
 --- | --- | --- | 
_id | ObjectID | MongoDB objectID (string)
name | string | Name of section
description | string[0,1000] | Description of section
active | boolean | Active section flag
position | number | Current position
posID | string,null | Internal ID in external POS system
mode | nested schema object | **Section mode schema**
isDirectLink | boolean | Is section available only by direct link
showOutsideSchedule | boolean | Allow to show outside schedule
schedule | array[nested schema],null | **Section schedule schema**

#### Section mode schema
 Property | Type | Description
 --- | --- | --- | 
type | string<br />Enum: static, interactive, link, category | Section mode type
link | string | Section link (if type: interactive)
staticDoc | string,null | 

#### Section schedule schema
 Property | Type | Description
 --- | --- | --- | 
dayOfWeek | number[0,6] | Day of the week (0 - Sunday, 1 - Monday)
active | boolean | Is section active in this day
from | string | Time from
till | string | Time till
<!-- schema-block-end:/services/menu/sections/schema:schema -->

