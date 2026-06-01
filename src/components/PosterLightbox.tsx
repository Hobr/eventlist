import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";
import { useState } from "react";

interface Props {
    src: string;
    alt: string;
}

export default function PosterLightbox({ src, alt }: Props) {
    const [open, setOpen] = useState(false);

    return (
        <>
            <img
                src={src}
                alt={alt}
                className="w-full max-w-sm rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                onClick={() => setOpen(true)}
            />
            <Lightbox
                open={open}
                close={() => setOpen(false)}
                slides={[{ src }]}
            />
        </>
    );
}
