var titles = [
    {id: "Fond_de_Plan",
    text: "Fond de plan",
    values: [
        "Sections",
        "Parcelles",
        "Bati3D",
        "Hydrographie"
    ]},
    {id: "immo",
    text: "Immobilier",
    values: [
        "S1",
    ]},
    {id: "urba",
    text: "Urbanisme",
    values: [
        "S1",
        "S2",
    ]},
];

function fillMenus(){
    for (const mainMenu of titles){
        var newButton = $('<button/>',{
            class:"btn",
            text: mainMenu.text,
            'data-toggle':"collapse", // mainMenu == 'Fond de Plan' ? "collapse"
            'data-target':"#collapse"+mainMenu.id,
            'aria-expanded':"true",
            'aria-controls':"collapse"+mainMenu.id
        });
        // todo : add sub menus
        $("#accordion").append(
            $('<div/>', {class: "card"}).append(
                $('<div/>',{
                    class:"card-reader",
                    id:"heading"+mainMenu.id
                }).append(newButton)
            )
    );
    }
}