import {allLayers} from '../data/LayersList'

function Menu(){
    const categories = allLayers.reduce(
        (acc, layer) => acc.includes(layer.categorie) ? acc : acc.concat(layer.categorie), []
    )
    
    categories.map((cat) => console.log(cat));
    return (
        <div>
            <ul>
                {categories.map((cat => 
                    (<li key={cat}>{cat}</li>)
                ))}
            </ul>
            <ul>
                {categories.map((layer) => 
                    (<li key={layer.name}>{layer.displayable_name}</li>)
                )}
            </ul>
        </div>
    )
}

export default Menu