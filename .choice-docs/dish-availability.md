# 🚀 (Beta) Dish availability

> `POST /menu/:language/full/availability`

:warning: Has rate limit 1 request / 5 seconds

#### Params:
<!-- schema-block-begin:/services/menu/full/schema:params -->

 Property | Type | Description
 --- | --- | --- | 
language | string[2] | Current language (ex. en, de, cs)
<!-- schema-block-end:/services/menu/full/schema:params -->

### Query
<!-- schema-block-begin:/services/menu/full/schema:syncMenuAvailabilityOptions -->

 Property | Type | Description
 --- | --- | --- | 
skipMissing | boolean | Skip missing db items in payload
<!-- schema-block-end:/services/menu/full/schema:syncMenuAvailabilityOptions -->

### Payload (any of these fields):
<!-- schema-block-begin:/services/menu/full/schema:syncMenuAvailability -->

 Property | Type | Description
 --- | --- | --- | 
sections | array[nested schema] | **Section availability schema**
categories | array[nested schema] | **Category availability schema**
dishes | array[nested schema] | **Dish availability schema (at least one of this property should be in payload)**
dishOptions | array[nested schema] | **Dish option availability schema**

#### Section availability schema
 Property | Type | Description
 --- | --- | --- | 
**posID** * | string | Internal ID of entity
**active** * | boolean | Active section flag

#### Category availability schema
 Property | Type | Description
 --- | --- | --- | 
**posID** * | string | Internal ID of entity
**active** * | boolean | Active flag

#### Dish availability schema (at least one of this property should be in payload)
 Property | Type | Description
 --- | --- | --- | 
**posID** * | string | Internal ID of entity
active | boolean(=true) | Active section flag
attributes | array[string]<br/> Enum: SOLD_OUT | Empty array is no attributes
availability | nested schema object | **Dish availability schema**

#### Dish availability schema
 Property | Type | Description
 --- | --- | --- | 
**areas** * | nested schema object | **Dish areas sync schema**

#### Dish areas sync schema
 Property | Type | Description
 --- | --- | --- | 
takeaway | boolean | Available for takeaway
delivery | boolean | Available for delivery
readOnly | boolean | Available for read only menu (digital menu)
simple | nested schema object | Available for tables (dine-in). Use: { [areaPosID]: boolean }

#### Dish option availability schema
 Property | Type | Description
 --- | --- | --- | 
**posID** * | string | Internal ID of entity
**active** * | boolean | Active flag
**list** * | array[nested schema] | **Dish option list availability schema**

#### Dish option list availability schema
 Property | Type | Description
 --- | --- | --- | 
**posID** * | string | Internal ID of entity
**active** * | boolean | Active flag
<!-- schema-block-end:/services/menu/full/schema:syncMenuAvailability -->

Response: 204 HTTP code

### Example 

```json
{
  "sections": [
    {
      "posID": "000000001",
      "active": true
    }
  ],
  "categories": [
    {
      "posID": "000000001",
      "active": true
    }
  ],
  "dishes": [
    {
      "posID": "525",
      "active": false,
      "attributes": [
        "SOLD_OUT"
      ]
    },
    {
      "posID": "2843",
      "active": false,
      "attributes": [
        "SOLD_OUT"
      ],
      "availability": {
        "areas": {
            "takeaway": true,
            "delivery": true,
            "readOnly": true,
            "simple": {
                "main-area-pos-id": false
            }
        }
      }
    }
  ],
  "dishOptions": [
    {
      "posID": "DO-6579",
      "active": false,
      "list": [
        {
          "posID": "6579",
          "active": true
        }
      ]
    },
    {
      "posID": "DO-6909",
      "active": false,
      "list": [
        {
          "posID": "6909",
          "active": false
        }
      ]
    }
  ]
}
```

